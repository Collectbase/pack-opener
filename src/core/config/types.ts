/**
 * Public option surface of the package. Everything a host may tune lives here;
 * anything not passed falls back to the chosen preset.
 *
 * Two levels on purpose: `variant` picks the animation mechanic (its own scene
 * module), `preset` picks a set of numbers for that mechanic. New styles arrive
 * as new variants, new looks as new presets — neither changes this shape.
 */
export type VariantName = 'slice';

export type PresetName = 'classic';

/** Colour in any CSS form the scene can parse: `#rgb`, `#rrggbb`, `rgba(...)`. */
export type Color = string;

export interface AssetOptions {
  /** Pack artwork. Required — the scene has nothing to cut without it. */
  pack: {url: string};
  /** Card artwork revealed after the lid tears away. */
  card?: {
    url?: string;
    /** Give up waiting for the artwork and finish the reveal without it. */
    timeoutMs?: number;
  };
}

export interface ThemeOptions {
  /** Page behind the scene. `'transparent'` lets the host's own background through. */
  background?: Color | 'transparent';
  /** Halo that settles around the revealed card — usually the rarity colour. */
  glow?: Color;
  /** Thin light rim hugging the card silhouette. */
  rim?: Color;
  /** Soft radial bloom behind the card while it is still blank. */
  bloom?: Color;
  /** Beam that runs around the card outline, and the sparks it throws. */
  beam?: Color;
  spark?: Color;
  /** Comet that mimes the swipe before the first touch. */
  hint?: Color;
  /** Blank slab the card shows while it spins, top to bottom, plus its sheen. */
  cardBack?: {
    top?: Color;
    mid?: Color;
    bottom?: Color;
    sheen?: Color;
  };
  /** Corner radius of the card, in css px. */
  cornerRadius?: number;
}

export interface MotionOptions {
  /** Multiplies every duration below. 2 plays the whole thing twice as fast. */
  speed?: number;
  /** Fade-in of the pack once the scene is live. */
  introMs?: number;
  /** Blade travel after the cut is committed. */
  finishMs?: number;
  /** Programmatic cut, when the host calls `autoSlice()`. */
  autoSliceMs?: number;
  /** Putting the pack back together after an abandoned swipe. */
  retractMs?: number;
  /**
   * Tearing the lid off and sliding the card out are one timeline, not two
   * steps: the fractions below are shares of `ms`, and they overlap on purpose.
   */
  open?: {
    ms?: number;
    /** Share of the timeline the lid takes to fly off and fade. */
    lid?: number;
    /** When the card starts to move — deliberately before the lid is done. */
    cardFrom?: number;
    /** How far the emptied wrapper sinks, in pack heights. */
    sink?: number;
    /** The wrapper fades while it sinks and is gone by this point. */
    gone?: number;
    /** When the clip stops tracking the lip and opens up. */
    clipFrom?: number;
  };
  reveal?: {
    spinMs?: number;
    unveilMs?: number;
    beamMs?: number;
    /** The card sits still with its halo before the host takes over. */
    holdMs?: number;
    /** Full turns the blank card makes while it floats. */
    spinTurns?: number;
    beamTail?: number;
    sparks?: number;
  };
}

export interface InteractionOptions {
  /** Horizontal travel (css px) before the swipe counts as started. */
  activation?: number;
  /** Fraction of the pack width the finger must cover to commit the cut. */
  completeFraction?: number;
  /** Distance between recorded trail points, and how many are kept. */
  trailStep?: number;
  trailMaxPoints?: number;
  /** How many points before the blade still have a partially closed gap. */
  rampPoints?: number;
  /** Half-width of the fully opened cut, in pack-height units. */
  gapRatio?: number;
  /** Share of the gap spent on the ragged foil edge. */
  edgeJitter?: number;
  /** Mask padding so shapes always overshoot the artwork. */
  overshoot?: number;
  /** Vertical band of the pack the cut may travel through, top-down. */
  band?: {top?: number; bottom?: number};
}

export interface LayoutOptions {
  /**
   * Card size relative to the pack. It has to read as something that came out
   * of the wrapper, so the width is capped against the pack, not the screen.
   * The aspect ratio is always kept — the cap moves both sides.
   */
  card?: {
    heightRatio?: number;
    packWidthRatio?: number;
    /** Fallback aspect until the artwork's own ratio is known. */
    aspect?: number;
  };
}

export interface HintOptions {
  /** Where the streak sits inside the pack, top-down. */
  lineRatio?: number;
  /** Share of the pack width the streak travels. */
  sweep?: number;
  /** Radius of the comet head; the tail tapers down from here. */
  headRadius?: number;
  /** Length of the tail, in pack widths. */
  tail?: number;
  /** Tail resolution — discs have to overlap, or the tail reads as beads. */
  segments?: number;
  /** One pass of the hint, and the pause between passes. */
  loopMs?: number;
  idleMs?: number;
  fadeMs?: number;
}

export interface PackOpenerOptions {
  variant?: VariantName;
  preset?: PresetName;
  assets: AssetOptions;
  theme?: ThemeOptions;
  motion?: MotionOptions;
  interaction?: InteractionOptions;
  layout?: LayoutOptions;
  hint?: HintOptions;
}

/** Every field filled in — what the scene actually runs on. */
export type Resolved<T> = {
  [K in keyof T]-?: T[K] extends object | undefined
    ? Resolved<NonNullable<T[K]>>
    : NonNullable<T[K]>;
};

export type ResolvedOptions = Resolved<Required<PackOpenerOptions>>;
