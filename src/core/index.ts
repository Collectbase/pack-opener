import {Application, Assets, Texture} from 'pixi.js';
import {DEFAULT_PEDESTAL_URI} from './variants/shared/defaultPedestal';
import {MESSAGES} from './config/protocol';
import {resolveOptions} from './config/resolve';
import type {ClimbCard, PackOpenerOptions, ResolvedOptions} from './config/types';
import {loadOwnTexture, releaseTexture} from './runtime/ownTexture';
import {createSound, type SceneSound} from './sound';
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

/**
 * The `timeline` event's payload: phase lengths in ms, after `motion.speed`.
 * `spinMs`, `unveilMs` and `beamMs` are the lengths of 0.4's slice phases,
 * still announced for hosts that score by them — deprecated, kept for now
 * (to be removed in a later release). `climb`'s own `spinMs` is one turn of
 * its items, and stays.
 */
export type PackOpenerTimeline = Partial<
  Record<
    | 'spinMs'
    | 'unveilMs'
    | 'beamMs'
    | 'chargeMs'
    | 'landMs'
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
    | 'flipMs'
    | 'introMs'
    | 'reelMinMs'
    | 'reelMaxMs'
    | 'stopStaggerMs'
    | 'flipStaggerMs'
    | 'hitHoldMs'
    | 'rollUpMs',
    number
  >
>;

/** The numbers a host scoring the ceremony needs, read off the resolved options. */
function timelineOf(resolved: ResolvedOptions): PackOpenerTimeline {
  const o = resolved as unknown as {
    motion: {reveal: Record<string, unknown>; open: Record<string, unknown>};
    slice?: Record<string, unknown>;
    charge?: Record<string, unknown>;
    burst?: Record<string, unknown>;
    carousel?: Record<string, unknown>;
    climb?: Record<string, unknown>;
  };
  const pick = (source: Record<string, unknown> | undefined, key: string) =>
    typeof source?.[key] === 'number' ? (source[key] as number) : undefined;
  const timeline: PackOpenerTimeline = {
    // 0.4's slice phases start with the lid, the charge and the turn — see the
    // slice scene's `announceLegacyPhase`
    spinMs: o.slice ? pick(o.motion.open, 'ms') : pick(o.climb, 'spinMs'),
    unveilMs: pick(o.slice, 'chargeMs'),
    beamMs: pick(o.slice, 'flipMs'),
    chargeMs: pick(o.slice, 'chargeMs'),
    landMs: pick(o.slice, 'landMs'),
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
    flipMs: pick(o.carousel, 'flipMs') ?? pick(o.slice, 'flipMs'),
    introMs: pick(o.climb, 'introMs'),
    reelMinMs: pick(o.climb, 'reelMinMs'),
    reelMaxMs: pick(o.climb, 'reelMaxMs'),
    stopStaggerMs: pick(o.climb, 'stopStaggerMs'),
    flipStaggerMs: pick(o.climb, 'flipStaggerMs'),
    hitHoldMs: pick(o.climb, 'hitHoldMs'),
    rollUpMs: pick(o.climb, 'rollUpMs'),
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
  /**
   * Begin a ceremony that starts on the host's word — the climb's items fly
   * in and spin until `setCards`. Call it once per batch the player buys,
   * then `setCards`; a batch shown as several grids sends each grid after
   * the first with `setCards` alone, once the grid before it is up
   * (`allRevealed`). Cards sent a moment before are not lost to it: still
   * loading, they land in this ceremony; already in, the ceremony they began
   * goes on as this one while it is still spinning. Cards still loading for
   * a ceremony `start()` began before are dropped with it. Puts the speed
   * back to 1× — a host showing a faster pace sends `setSpeed` again after
   * it. A no-op for a mechanic opened by a gesture.
   */
  start: () => void;
  /**
   * The cards the climb's items turn into, in grid order, and the combo to
   * write under the grid once they are up — `extras.combo`, the host's own
   * words. Each card's artwork is loaded first, outside Pixi's shared cache,
   * decoded no larger than the scene draws a card at
   * `performance.resolutionCap`, and freed once the scene lets the cards go
   * (the next batch, `reset()`, `destroy()`): one that fails, or is not in
   * within `assets.card.timeoutMs`, turns into a blank card. Resolves once
   * the cards are handed over, not once they are shown; a later call
   * supersedes one still loading. With no ceremony spinning to take them —
   * none started, or one whose items have begun to stop or are all up — it
   * starts one of its own, at the pace `setSpeed` last set. No cards at all
   * end the ceremony on show — or one of its own — at once, on an empty
   * grid: `done`, then an `allRevealed` with no cards. A no-op for the other
   * mechanics.
   */
  setCards: (cards: ClimbCard[], extras?: {combo?: string | null}) => Promise<void>;
  /**
   * How fast the climb's items spin, as a multiple of their pace — Speed
   * up's 1, 2, 3 or 4 — from this frame on: the reel (its turns, its
   * colours, its shortest run) and the items coming to rest one by one,
   * whatever is under way, never waiting for a reset. The fly-in, the turns
   * of the cards, the hits, the combo, the prices and the gather always run
   * at 1×. Phases announced from then on carry their length at that pace. `start()` and `reset()` put it back to 1×; a ceremony
   * `setCards` starts on its own keeps it. A no-op for the other mechanics.
   */
  setSpeed: (multiplier: number) => void;
  /**
   * The climb at its end at once: every item stopped on its colour and
   * turned into its card, every price at its figure, the combo written, no
   * flash. What the host has not been told yet — `cardSettled`,
   * `cardRevealed`, `hitsRevealed` — comes now in the usual order, marked
   * `skipped: true`, then `allRevealed`, once. A ceremony still waiting for
   * its cards ends the moment they come. With a `setCards` still loading,
   * the skip is kept for those cards — with nothing started too — and they
   * land at their end once they are in; until then whatever is on show
   * plays on at its pace, a ceremony whose earlier cards are already in
   * included. With nothing loading it is a no-op before `start()` and once
   * every card is up. A no-op for the other mechanics.
   */
  skipToEnd: () => void;
  /**
   * The climb's cards `indices` (in grid order) sold since they came: each
   * goes dark and shows `SOLD` under its price — at once when it is up, once
   * its price has counted otherwise. Sent while a `setCards` is still
   * loading, it waits for those cards and tells them. Cards sold with the
   * purchase come with `sold: true` in `setCards` instead. Indices outside
   * the grid, or of cards sold already, are passed over. A no-op for the
   * other mechanics.
   */
  markSold: (indices: number[]) => void;
  /**
   * Shakes the climb's stage on the host's word — a sold sum reaching the
   * balance, say: `strength` 0..1 of the hardest blow the scene strikes
   * itself, scaled by `climb.shake`. The cards move; what is written under
   * them and the host's page do not. A no-op before `start()` and for the
   * other mechanics.
   */
  shake: (strength?: number) => void;
  /**
   * Marks a moment of the host's own with sound — `coins` as a climb's sold
   * sum sets off for the balance. The scene tells it as `MESSAGES.CUE`; the
   * score plays what it has for that name, and nothing for a name it does
   * not know.
   */
  cue: (name: string) => void;
  /**
   * Put the pack back together and rearm the gesture. The climb goes back to
   * its empty grid at 1×: cards still loading are dropped, and every card's
   * artwork is freed.
   */
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
 * The least card artwork is decoded to, in px tall, however small the scene
 * draws its cards now: a stage with no size yet may grow before they show.
 */
const ART_MIN_HEIGHT = 512;

/**
 * `url` as a texture of the caller's own (`loadOwnTexture`) no taller than
 * `maxHeight` px, or null once it fails or `timeoutMs` runs out — one that
 * comes in after that is let go of.
 */
function loadOwnWithin(url: string, timeoutMs: number, maxHeight: number): Promise<Texture | null> {
  if (!url) return Promise.resolve(null);
  return new Promise(resolve => {
    let over = false;
    const timer = setTimeout(() => {
      over = true;
      resolve(null);
    }, Math.max(0, timeoutMs));
    loadOwnTexture(url, maxHeight).then(
      texture => {
        if (over) {
          releaseTexture(texture);
          return;
        }
        over = true;
        clearTimeout(timer);
        resolve(texture);
      },
      () => {
        if (over) return;
        over = true;
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
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
  // The sound hears every message the host does, a moment before it
  let sound: SceneSound | null = null;
  const emit = (type: string, payload?: Record<string, unknown>) => {
    sound?.hear(type, payload);
    onEvent?.(payload ? {type, ...payload} : {type});
  };

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

  sound = createSound(resolved.variant, resolved.sound);
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

  let destroyed = false;

  const tick = (ticker: {deltaMS: number}) => {
    scene.update(ticker.deltaMS);
    // Torn down by the host from inside an event the frame sent: the app is gone
    if (destroyed) return;
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
    // Any touch is the gesture a browser waits for before it lets audio start
    sound?.unlock();
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
      onCancel(event);
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
  /**
   * The gesture taken away rather than finished: the browser claimed it
   * (`pointercancel`), or a mouse was let go outside the window. A scene that
   * tells a tap from a drag drops it; to any other it is a release, as it
   * always was.
   */
  const onCancel = (event: PointerEvent) => {
    if (!dragging) {
      return;
    }
    dragging = false;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    if (scene.onCancel) {
      scene.onCancel();
    } else {
      scene.onUp();
    }
  };

  const onDragStart = (event: Event) => event.preventDefault();

  /**
   * A rotated phone or a resized window leaves the pack sized for a stage that
   * is gone, so the scene re-derives it. The scene reports the new geometry
   * itself — it does the same after a retune, which changes it just as much.
   * A resized canvas is blank until it is drawn again, and a sleeping scene
   * would leave it so until its next tick, up to a second later — so it is
   * woken.
   */
  const onResize = () => {
    scene.resize?.();
    wake();
  };
  app.renderer.on('resize', onResize);

  canvas.addEventListener('dragstart', onDragStart);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);

  // The latest `setCards` still loading. A later one, a reset or the end drops
  // it, and so does `start()` when it was sent for the ceremony `start()`
  // replaces (`own`); sent with nothing waiting, it lands in the next one.
  // `skip`: `skipToEnd()` came meanwhile, so the ceremony ends once it lands;
  // `sold`: cards of it `markSold()` named meanwhile, told once it lands
  let cardsCall = 0;
  let loading: {call: number; own: boolean; skip: boolean; sold: number[]} | null = null;

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
      // On the spot, whatever becomes of the rest: a mute cannot wait for a reset
      sound?.set(nextResolved.sound);
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
    start: () => {
      if (!scene.start) return;
      // Cards loading for the ceremony this one replaces go with it; sent with
      // nothing waiting for them, they are this one's
      if (loading?.own) {
        cardsCall++;
        loading = null;
      } else if (loading) {
        loading.own = true;
      }
      wake();
      scene.start();
    },
    setCards: async (cards: ClimbCard[], extras?: {combo?: string | null}) => {
      if (!scene.setCards) return;
      const call = ++cardsCall;
      // A skip asked for the batch this one supersedes holds for this one
      const mine = {call, own: !!scene.awaitingCards, skip: loading?.skip ?? false, sold: [] as number[]};
      loading = mine;
      const list = Array.isArray(cards) ? cards : [];
      const timeoutMs = current.assets.card.timeoutMs;
      // No taller than the tallest card is drawn, at the sharpest the canvas
      // may get: a photo many times that would be held whole for the batch
      const sharpest = Math.max(current.performance.resolutionCap, app.renderer.resolution);
      const maxHeight = Math.max(ART_MIN_HEIGHT, Math.ceil((scene.cardHeight ?? Infinity) * sharpest));
      // The cards go to the scene at once — the items stop on their colours
      // without waiting on any artwork — and each artwork follows as it
      // loads: a card waits for its own only to turn. One load per artwork,
      // shared by the cards that repeat it; a url may come as a promise of one
      const loads = new Map<unknown, {load: Promise<Texture | null>; indices: number[]}>();
      list.forEach((card, i) => {
        const key = card?.url ?? '';
        let entry = loads.get(key);
        if (!entry) {
          const load = Promise.resolve(key)
            .catch(() => '')
            .then(url => loadOwnWithin(typeof url === 'string' ? url : '', timeoutMs, maxHeight));
          entry = {load, indices: []};
          loads.set(key, entry);
        }
        entry.indices.push(i);
      });
      loading = null;
      wake();
      scene.setCards(
        list.map(card => ({
          pending: true,
          texture: null,
          color: card?.color,
          hit: !!card?.hit,
          price: card?.price ?? null,
          tier: card?.tier ?? null,
          sold: !!card?.sold,
        })),
        extras?.combo ?? null,
      );
      const token = scene.cardsToken;
      if (mine.sold.length) scene.markSold?.(mine.sold);
      if (mine.skip) scene.skipToEnd?.();
      await Promise.all(
        [...loads.values()].map(async ({load, indices}) => {
          const texture = await load;
          const live = !destroyed && call === cardsCall;
          const taken = live && indices.map(i => !!scene.giveFace?.(token, i, texture)).some(Boolean);
          if (!taken) releaseTexture(texture);
          else wake();
        }),
      );
    },
    setSpeed: (multiplier: number) => {
      if (!scene.setSpeed) return;
      wake();
      scene.setSpeed(multiplier);
    },
    skipToEnd: () => {
      if (!scene.skipToEnd) return;
      wake();
      if (loading) {
        loading.skip = true;
      } else {
        scene.skipToEnd();
      }
    },
    markSold: (indices: number[]) => {
      if (!scene.markSold) return;
      const list = Array.isArray(indices) ? indices : [];
      // Indices of the cards still loading: the scene's are another batch's
      if (loading) {
        loading.sold.push(...list);
        return;
      }
      wake();
      scene.markSold(list);
    },
    shake: (strength?: number) => {
      if (!scene.shake) return;
      wake();
      scene.shake(strength);
    },
    cue: (name: string) => {
      if (typeof name === 'string' && name) emit(MESSAGES.CUE, {name, index: -1});
    },
    reset: () => {
      cardsCall++;
      loading = null;
      wake();
      scene.reset();
      sound?.reset();
    },
    setEnabled: (value: boolean) => {
      wake();
      scene.setEnabled(value);
    },
    destroy: () => {
      destroyed = true;
      app.renderer.off('resize', onResize);
      canvas.removeEventListener('dragstart', onDragStart);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      app.ticker.remove(tick);
      scene.destroy?.();
      sound?.destroy();
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
