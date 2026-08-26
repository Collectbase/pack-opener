import type {ResolvedOptions} from '../config/types';

/**
 * A variant is one animation mechanic: how the pack is opened and what the
 * reveal looks like. `slice` cuts the seal with a finger; a future one might
 * tear a corner or shake the pack apart.
 *
 * Everything a variant needs is handed to it in the context, and everything the
 * host needs from it is on the instance — so adding a mechanic means adding a
 * folder here, with no changes to the engine or either wrapper.
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

  /** Open without a gesture. */
  autoSlice: () => void;
  /** Back to the untouched state, gesture rearmed. */
  reset: () => void;
  setEnabled: (value: boolean) => void;

  /** Card artwork usually arrives after the animation has started. */
  setCardTexture: (texture: unknown) => void;

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
