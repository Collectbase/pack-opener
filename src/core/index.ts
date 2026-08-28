import {Application, Assets} from 'pixi.js';
import {MESSAGES} from './config/protocol';
import {resolveOptions} from './config/resolve';
import type {PackOpenerOptions} from './config/types';
import {variantOf} from './variants';

export interface PackOpenerEvent {
  type: string;
  [key: string]: unknown;
}

export interface PackOpenerInstance {
  /**
   * Retunes a running scene. Returns false when the change cannot be applied in
   * place — a different variant, or different pack artwork — and the host has
   * to mount the animation again to see it.
   */
  setOptions: (options: PackOpenerOptions) => boolean;
  /** Cut the pack without a gesture. */
  autoSlice: () => void;
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
  target.appendChild(canvas);

  let texture;
  try {
    texture = await Assets.load({
      src: resolved.assets.pack.url,
      loadParser: 'loadTextures',
    });
  } catch (error) {
    app.destroy(true, {children: true});
    throw error;
  }

  const scene = variant.create({app, texture, options: resolved, emit});

  // The card can arrive late: the scene waits for it and finishes without it
  // once `assets.card.timeoutMs` runs out
  if (resolved.assets.card.url) {
    Assets.load({src: resolved.assets.card.url, loadParser: 'loadTextures'})
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

  const onDown = (event: PointerEvent) => {
    // A finger is the one input that must never wait for a slow frame
    wake();
    // Capture keeps the cut following a finger that slides off the canvas
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
    const p = local(event);
    scene.onDown(p.x, p.y);
  };
  const onMove = (event: PointerEvent) => {
    const p = local(event);
    scene.onMove(p.x, p.y);
  };
  const onUp = (event: PointerEvent) => {
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    scene.onUp();
  };

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
        return false;
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
      scene.setOptions(nextResolved);
      wake();
      return true;
    },
    autoSlice: () => {
      wake();
      scene.autoSlice();
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
