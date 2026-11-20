import type {ResolvedOptions} from '../config/types';

/**
 * A variant is one animation mechanic: how the pack is opened and what the
 * reveal looks like. `slice` cuts the seal with a finger; a future one might
 * tear a corner or shake the pack apart.
 *
 * Everything a variant needs is handed to it in the context, and everything the
 * host needs from it is on the instance — so a mechanic the handle already
 * drives (a gesture, `autoSlice`, `shuffle`, `reset`) is a folder here, with
 * no changes to the engine or either wrapper. One that needs a command of
 * its own, as `climb` does with `start` and `setCards`, also adds it to the
 * engine's handle and to the wrappers that offer it.
 */
export interface VariantContext {
  /** Live Pixi application; the variant draws into `app.stage`. */
  app: unknown;
  /** Pack artwork, already loaded. */
  texture: unknown;
  /** Options with every field filled in from this variant's preset. */
  options: ResolvedOptions;
  /**
   * How the variant reports what happened. Names come from `config/protocol`;
   * a host turns them into callbacks or bridge messages.
   */
  emit: (type: string, payload?: Record<string, unknown>) => void;
}

export interface VariantInstance {
  /** Advance the animation. Called once per frame with the frame delta. */
  update: (deltaMS: number) => void;

  /** Gesture, in css px relative to the canvas. */
  onDown: (x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onUp: () => void;
  /**
   * The gesture was taken away rather than let go of — the browser claimed
   * it (`pointercancel`) or a mouse was released outside the window.
   * Optional: without it the engine calls `onUp`, as it always has.
   */
  onCancel?: () => void;

  /** Open without a gesture. */
  autoSlice: () => void;
  /**
   * Mix the choice up, for a mechanic that offers one (`carousel` spins its
   * ring). Optional: a mechanic with nothing to shuffle omits it.
   */
  shuffle?: () => void;
  /**
   * Begin a ceremony that starts on the host's word rather than a gesture
   * (`climb`'s items fly in and spin). Optional: a mechanic opened by a
   * gesture omits it.
   */
  start?: () => void;
  /**
   * The cards a multi-card ceremony turns into and the line written once
   * they are up (`climb`'s combo): `texture` loaded already (null where it
   * never came), or `pending`, to follow with `giveFace`. The textures are
   * the scene's from then on: it frees them once it lets the cards go.
   * Optional: a single-card mechanic omits it.
   */
  setCards?: (
    cards: {texture: unknown; pending?: boolean; color: string; hit: boolean; price: number | null}[],
    combo: string | null,
  ) => void;
  /** The batch the last `setCards` handed over, for `giveFace` to name; null once the scene let it go. */
  readonly cardsToken?: object | null;
  /**
   * A pending card's artwork, come late — or null, none came — for the batch
   * `token` names: true when the scene took it, false when that batch is gone
   * (the caller frees the texture). Optional, with `setCards`.
   */
  giveFace?: (token: object | null | undefined, index: number, texture: unknown) => boolean;
  /**
   * The tallest a card `setCards` brings is drawn on the stage as it is now,
   * in css px: the engine decodes each card's artwork no taller than that at
   * `performance.resolutionCap`, so a photo many times the size is not held
   * whole. Optional, with `setCards`: without it the artwork keeps its size.
   */
  readonly cardHeight?: number;
  /**
   * True while a ceremony `start()` began can still take its cards: cards
   * sent meanwhile belong to it, and a later `start()` drops them with it.
   * Optional, with `start`.
   */
  readonly awaitingCards?: boolean;
  /**
   * How fast a ceremony that starts on the host's word plays, as a multiple
   * of its pace, from this frame on. Optional, with `start`.
   */
  setSpeed?: (multiplier: number) => void;
  /** That ceremony at its end at once. Optional, with `start`. */
  skipToEnd?: () => void;
  /** Cards of the ceremony on show sold since they came, by their index. Optional, with `start`. */
  markSold?: (indices: number[]) => void;
  /** A blow to the stage on the host's word, `strength` 0..1. Optional, with `start`. */
  shake?: (strength?: number) => void;
  /** Back to the untouched state, gesture rearmed. */
  reset: () => void;
  setEnabled: (value: boolean) => void;

  /** Card artwork usually arrives after the animation has started. */
  setCardTexture: (texture: unknown) => void;
  /** Artwork of the stand the revealed card is shown above. */
  setPedestalTexture: (texture: unknown) => void;

  /**
   * New options for a scene that is already running. Optional: a variant that
   * cannot retune itself simply omits it and the engine remounts instead.
   * Returns true when the change is applied on the spot, false when it has to
   * wait for `reset()` — the scene is mid-ceremony or holding a revealed card.
   */
  setOptions?: (options: ResolvedOptions) => boolean;

  /**
   * The stage changed size; the variant re-derives whatever it measured against
   * it. Optional: a variant that draws in stage-relative units omits it.
   */
  resize?: () => void;

  /**
   * What the scene is doing right now, so the engine can throttle the frame
   * rate: `busy` while anything moves, `hint` while it only loops the hint,
   * `idle` once nothing changes. A variant that omits it is always driven at
   * full rate.
   */
  activity?: 'busy' | 'hint' | 'idle';

  /** Where the pack was drawn — hosts hang their own UI off it. */
  rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };

  destroy?: () => void;
}

export interface VariantModule {
  id: string;
  /**
   * Named parameter sets for this mechanic. `resolveOptions` reads them, so a
   * variant owns its own numbers instead of a shared table trying to describe
   * every mechanic at once.
   */
  presets: Record<string, unknown>;
  /** Default preset when the host does not name one. */
  defaultPreset: string;
  create: (context: VariantContext) => VariantInstance;
}
