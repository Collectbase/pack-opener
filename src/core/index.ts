import {Application, Assets, Texture} from 'pixi.js';
import {DEFAULT_PEDESTAL_URI} from './variants/shared/defaultPedestal';
import {MESSAGES} from './config/protocol';
import {resolveOptions} from './config/resolve';
import type {PackOpenerOptions, ResolvedOptions} from './config/types';
import {variantOf} from './variants';

export interface PackOpenerEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * What became of a retune: `applied` on the spot; `deferred` — the scene is
 * mid-ceremony or holding a revealed card, so the change waits for `reset()`;
 * `scene` — a different variant or different pack artwork, which the host has
 * to mount the animation again to see.
 */
export type SetOptionsResult = 'applied' | 'deferred' | 'scene';

/** The `timeline` event's payload: phase lengths in ms, after `motion.speed`. */
export type PackOpenerTimeline = Partial<
  Record<
    | 'spinMs'
    | 'unveilMs'
    | 'beamMs'
    | 'holdMs'
    | 'chargeHoldMs'
    | 'releaseMs'
    | 'beatMs'
    | 'swarmMs'
    | 'assembleMs'
    | 'snapMs'
    | 'shuffleMs'
    | 'dropMs'
    | 'riseMs'
    | 'dissolveMs'
    | 'factMs'
    | 'factGapMs'
    | 'bannerMs'
    | 'bannerHoldMs'
    | 'flipMs',
    number
  >
>;

/** The numbers a host scoring the ceremony needs, read off the resolved options. */
function timelineOf(resolved: ResolvedOptions): PackOpenerTimeline {
  const o = resolved as unknown as {
    motion: {reveal: Record<string, unknown>};
    charge?: Record<string, unknown>;
    burst?: Record<string, unknown>;
    carousel?: Record<string, unknown>;
  };
  const pick = (source: Record<string, unknown> | undefined, key: string) =>
    typeof source?.[key] === 'number' ? (source[key] as number) : undefined;
  const timeline: PackOpenerTimeline = {
    spinMs: pick(o.motion.reveal, 'spinMs'),
    unveilMs: pick(o.motion.reveal, 'unveilMs'),
    beamMs: pick(o.motion.reveal, 'beamMs'),
    holdMs: pick(o.motion.reveal, 'holdMs'),
    chargeHoldMs: pick(o.charge, 'holdMs'),
    releaseMs: pick(o.charge, 'releaseMs'),
    beatMs: pick(o.burst, 'beatMs'),
    swarmMs: pick(o.burst, 'swarmMs'),
    assembleMs: pick(o.burst, 'assembleMs'),
    snapMs: pick(o.burst, 'snapMs'),
    shuffleMs: pick(o.carousel, 'shuffleMs'),
    dropMs: pick(o.carousel, 'dropMs'),
    riseMs: pick(o.carousel, 'riseMs'),
    dissolveMs: pick(o.carousel, 'dissolveMs'),
    factMs: pick(o.carousel, 'factMs'),
    factGapMs: pick(o.carousel, 'factGapMs'),
    bannerMs: pick(o.carousel, 'bannerMs'),
    bannerHoldMs: pick(o.carousel, 'bannerHoldMs'),
    flipMs: pick(o.carousel, 'flipMs'),
  };
  for (const key of Object.keys(timeline) as (keyof PackOpenerTimeline)[]) {
    if (timeline[key] === undefined) delete timeline[key];
  }
  return timeline;
}

export interface PackOpenerInstance {
  /** Retunes a running scene; see `SetOptionsResult` for what the answer means. */
  setOptions: (options: PackOpenerOptions) => SetOptionsResult;
  /** Cut the pack without a gesture. */
  autoSlice: () => void;
  /** Mix the choice up — the carousel's ring spins on. A no-op for a mechanic without one. */
  shuffle: () => void;
  /** Put the pack back together and rearm the gesture. */
  reset: () => void;
  /** Ignore input without tearing the scene down. */
  setEnabled: (value: boolean) => void;
  destroy: () => void;
}

export interface CreateOptions {
  onEvent?: (event: PackOpenerEvent) => void;
}

/**
 * Pixi decodes textures off the main thread, which means fetch — and a blocking
 * extension or a corporate proxy can refuse that request while an <img> for the
 * same URL still loads. Artwork the host could display is not a reason to drop
 * the ceremony, so a refused fetch is retried the slow way.
 */
/**
 * `Assets.load` picks its parser from the URL's extension, which a data URI
 * does not have — the stand baked into the package has to go through an
 * `<img>` instead.
 */
async function loadImageTexture(url: string) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
  return Texture.from(image);
}

async function loadTexture(url: string) {
  try {
    return await Assets.load({src: url, loadParser: 'loadTextures'});
  } catch {
    const image = new Image();
    // WebGL refuses to sample an image fetched without CORS
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`could not load ${url}`));
      image.src = url;
    });
    return Texture.from(image);
  }
}

/**
 * Mounts the animation into `target` and hands back a handle.
 *
 * This is the whole engine: both hosts go through it. The React Native wrapper
 * runs it inside a WebView and forwards `onEvent` across the bridge; a web host
 * calls it directly and gets the same events as plain callbacks.
 */
export async function createPackOpener(
  target: HTMLElement,
  options: PackOpenerOptions,
  {onEvent}: CreateOptions = {},
): Promise<PackOpenerInstance> {
  const resolved = resolveOptions(options);
  const emit = (type: string, payload?: Record<string, unknown>) =>
    onEvent?.(payload ? {type, ...payload} : {type});

  const variant = variantOf(resolved.variant);
  // The live option set: the frame caps and `setOptions` both read it
  let current = resolved;
  const isOpaque = (color?: string) => !!color && color !== 'transparent';
  const background = resolved.theme.background;
  const opaque = isOpaque(background);

  const app = new Application();
  await app.init({
    background: opaque ? background : undefined,
    backgroundAlpha: opaque ? 1 : 0,
    antialias: resolved.performance.antialias,
    resolution: Math.min(
      window.devicePixelRatio || 1,
      resolved.performance.resolutionCap,
    ),
    autoDensity: true,
    // A full-page host (the WebView) tracks the window; an embedded canvas
    // tracks its own box, so the pack stays centred inside the element
    resizeTo: target === document.body ? window : target,
    preference: 'webgl',
  });

  const canvas = app.canvas;
  canvas.style.display = 'block';
  // Without this the browser claims the gesture for scrolling mid-cut
  canvas.style.touchAction = 'none';
  // A drag across a canvas is otherwise read as a text selection or an image
  // drag, so the cut leaves a highlight trailing behind it and the pointer
  // turns into a drag ghost
  canvas.style.userSelect = 'none';
  canvas.style.setProperty('-webkit-user-select', 'none');
  canvas.style.setProperty('-webkit-user-drag', 'none');
  // Long-pressing the pack on iOS would offer to save the canvas as an image
  canvas.style.setProperty('-webkit-touch-callout', 'none');
  target.appendChild(canvas);

  let texture;
  try {
    texture = await loadTexture(resolved.assets.pack.url);
  } catch (error) {
    app.destroy(true, {children: true});
    throw error;
  }

  const scene = variant.create({app, texture, options: resolved, emit});

  // The stand the card lands over: the host's own when it sent one, otherwise
  // the one baked in. Either way it is late-loading like the card — nothing in
  // the ceremony waits for it
  const pedestalUrl = resolved.assets.pedestal.url;
  (pedestalUrl
    ? loadTexture(pedestalUrl)
    : loadImageTexture(DEFAULT_PEDESTAL_URI)
  )
    .then((pedestalTexture: unknown) =>
      scene.setPedestalTexture(pedestalTexture),
    )
    .catch(() => {});

  // The card can arrive late: the scene waits for it and finishes without it
  // once `assets.card.timeoutMs` runs out
  if (resolved.assets.card.url) {
    loadTexture(resolved.assets.card.url)
      .then((cardTexture: unknown) => scene.setCardTexture(cardTexture))
      .catch(() => {});
  }

  // A phone-sized WebGL canvas redrawn 60 times a second is what makes a device
  // hot, and the scene spends most of its life with nothing new to draw
  const frameCapFor = (activity: string) => {
    const perf = current.performance;
    if (activity === 'idle') {
      return Math.max(1, perf.sleepFps);
    }
    return activity === 'hint' ? perf.idleFps : perf.maxFps;
  };

  /**
   * Back to full rate at once. A sleeping scene ticks about once a second, so a
   * command arriving in that gap would sit there unanswered — long enough to
   * read as the animation being stuck.
   */
  const wake = () => {
    app.ticker.maxFPS = current.performance.maxFps;
  };

  const tick = (ticker: {deltaMS: number}) => {
    scene.update(ticker.deltaMS);
    const wanted = frameCapFor(scene.activity ?? 'busy');
    if (app.ticker.maxFPS !== wanted) {
      app.ticker.maxFPS = wanted;
    }
  };
  app.ticker.maxFPS = resolved.performance.maxFps;
  app.ticker.add(tick);

  // Pointer events cover finger, stylus and mouse in one path — the scene only
  // ever sees a position
  const local = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {x: event.clientX - rect.left, y: event.clientY - rect.top};
  };

  // A mouse reports movement while nothing is pressed, so the scene may only
  // hear about a drag it has seen begin — a finger has no such state to track
  let dragging = false;

  const onDown = (event: PointerEvent) => {
    // The cut is a primary-button drag: a right- or middle-click keeps its
    // native behaviour and must not slice the pack
    if (event.button !== 0) {
      return;
    }
    // Claims the gesture before the browser starts selecting or dragging with
    // it — unconditionally, so a press outside the pack cannot start one either
    event.preventDefault();
    // A finger is the one input that must never wait for a slow frame
    wake();
    // Capture keeps the cut following a finger that slides off the canvas
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
    dragging = true;
    const p = local(event);
    scene.onDown(p.x, p.y);
  };
  const onMove = (event: PointerEvent) => {
    if (!dragging) {
      return;
    }
    // Letting go outside the window swallows the pointerup, so the button state
    // is the only honest word on whether the drag is still going
    if (event.buttons === 0 && event.pointerType === 'mouse') {
      onUp(event);
      return;
    }
    const p = local(event);
    scene.onMove(p.x, p.y);
  };
  const onUp = (event: PointerEvent) => {
    if (!dragging) {
      return;
    }
    dragging = false;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    scene.onUp();
  };

  const onDragStart = (event: Event) => event.preventDefault();

  /**
   * A rotated phone or a resized window leaves the pack sized for a stage that
   * is gone, so the scene re-derives it. The scene reports the new geometry
   * itself — it does the same after a retune, which changes it just as much.
   */
  const onResize = () => scene.resize?.();
  app.renderer.on('resize', onResize);

  canvas.addEventListener('dragstart', onDragStart);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  emit(MESSAGES.READY, {
    width: app.screen.width,
    height: app.screen.height,
    rect: scene.rect,
    renderer: app.renderer.name,
  });
  emit(MESSAGES.TIMELINE, timelineOf(resolved));

  return {
    setOptions: (next: PackOpenerOptions) => {
      const nextResolved = resolveOptions(next);
      // The scene is built around one pack texture and one mechanic; changing
      // either is a new scene, not a new setting
      if (
        nextResolved.variant !== current.variant ||
        nextResolved.assets.pack.url !== current.assets.pack.url ||
        !scene.setOptions
      ) {
        return 'scene';
      }

      const nextBackground = nextResolved.theme.background;
      app.renderer.background.color = isOpaque(nextBackground)
        ? nextBackground
        : 0x000000;
      app.renderer.background.alpha = isOpaque(nextBackground) ? 1 : 0;

      if (nextResolved.assets.card.url !== current.assets.card.url) {
        const url = nextResolved.assets.card.url;
        if (url) {
          Assets.load({src: url, loadParser: 'loadTextures'})
            .then((texture: unknown) => scene.setCardTexture(texture))
            .catch(() => {});
        }
      }

      current = nextResolved;
      const live = scene.setOptions(nextResolved);
      wake();
      // Phase lengths are read live even when the geometry waits for a reset
      emit(MESSAGES.TIMELINE, timelineOf(nextResolved));
      return live ? 'applied' : 'deferred';
    },
    autoSlice: () => {
      wake();
      scene.autoSlice();
    },
    shuffle: () => {
      if (!scene.shuffle) return;
      wake();
      scene.shuffle();
    },
    reset: () => {
      wake();
      scene.reset();
    },
    setEnabled: (value: boolean) => {
      wake();
      scene.setEnabled(value);
    },
    destroy: () => {
      app.renderer.off('resize', onResize);
      canvas.removeEventListener('dragstart', onDragStart);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      app.ticker.remove(tick);
      scene.destroy?.();
      app.destroy(true, {children: true});
    },
  };
}

export {MESSAGES} from './config/protocol';
export {resolveOptions} from './config/resolve';
export {VARIANTS, variantOf} from './variants';
export type {
  VariantContext,
  VariantInstance,
  VariantModule,
} from './variants';
export * from './config/types';
