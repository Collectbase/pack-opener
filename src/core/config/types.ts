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
    /** How far the lid is thrown sideways, in pack widths. */
    lidThrowX?: number;
    /** How far up the lid is thrown, in pack heights. */
    lidThrowY?: number;
    /** How much the lid tumbles on its way out, in radians. */
    lidSpin?: number;
    /** The lid starts fading at this much of its throw, over this much of it. */
    lidFadeFrom?: number;
    lidFadeSpan?: number;
    /** Share of the timeline the uncut copy takes to disappear. */
    uncutFade?: number;
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
    /** How thin the card gets edge-on. 0 is a perfect edge and reads as a gap. */
    spinFlatness?: number;
    /** How much darker the card back goes edge-on. */
    spinShade?: number;
    /** Bloom while the card turns: this at the edge, full face-on. */
    spinBloom?: number;
    /** Peak opacity of the three glows. */
    bloomAlpha?: number;
    rimAlpha?: number;
    haloAlpha?: number;
    /** The travelling beam: core line, the glow under it, and its bright tip. */
    beamWidth?: number;
    beamAlpha?: number;
    beamGlowWidth?: number;
    beamGlowAlpha?: number;
    beamTipRadius?: number;
    /** Segments the beam is drawn with, and corner detail of the path it runs. */
    beamSteps?: number;
    outlineDetail?: number;
    /** Sparks thrown by the wipe: base size, extra size from jitter, opacity. */
    sparkSize?: number;
    sparkJitter?: number;
    sparkAlpha?: number;
    /** How far sparks scatter from the wipe edge, in css px. */
    sparkSpreadX?: number;
    sparkSpreadY?: number;
    /** One turn of the card while it waits for late artwork. */
    artWaitSpinMs?: number;
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
  /** How far past the edge the blade runs out after the cut is committed. */
  finishOvershoot?: number;
  /** Steepest the run-out may follow the trail — keeps it from diving off. */
  finishSlopeLimit?: number;
  /** How often progress is reported while the cut runs, as a share of it. */
  tickStep?: number;
  /**
   * The arc a programmatic cut follows, since there is no finger to trace:
   * inset from both sides, where it starts and ends, and the control point that
   * bends it. All in pack widths and heights.
   */
  autoArc?: {
    inset?: number;
    fromY?: number;
    toY?: number;
    controlY?: number;
  };
}

export interface LayoutOptions {
  /** Where the pack sits and how much of the stage it takes. */
  pack?: {
    /** Caps against the stage; the artwork's own aspect decides the rest. */
    widthRatio?: number;
    heightRatio?: number;
    /** Nudge down from the centre, in stage heights — leaves room for a hint. */
    offsetY?: number;
  };
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
    /** Widest the card may get, whatever the artwork's ratio says. */
    maxRatio?: number;
  };
  /**
   * Size of the three glows around the card. Spread is the softness baked into
   * the texture, padding is how far the sprite reaches past the card.
   */
  glow?: {
    bloomScaleX?: number;
    bloomScaleY?: number;
    rimSpread?: number;
    rimPadding?: number;
    haloSpread?: number;
    haloPadding?: number;
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
  /** Opacity of the tail at the head, and how fast it falls off behind it. */
  tailAlpha?: number;
  tailFalloff?: number;
  /** One pass of the hint, and the pause between passes. */
  loopMs?: number;
  idleMs?: number;
  fadeMs?: number;
}

/**
 * What the scene is allowed to spend. A WebGL canvas the size of a phone screen
 * redrawn sixty times a second is what makes a device hot, and most of the time
 * the scene has nothing new to draw: it is waiting for a finger, or the card has
 * already settled. These caps are the difference between a ceremony and a heater.
 */
export interface PerformanceOptions {
  /** Frame cap while something is actually moving. */
  maxFps?: number;
  /** Frame cap while the pack just hangs there and the hint loops. */
  idleFps?: number;
  /**
   * Frame cap once everything has settled and nothing changes until the host
   * asks for something. Keep it above zero — the scene still has to hear
   * `reset()` and option changes.
   */
  sleepFps?: number;
  /**
   * Ceiling on the device pixel ratio the canvas is drawn at. Phones report 3
   * and up; every step doubles the pixels the GPU has to shade for a scene made
   * of soft glows, where the difference is hard to see.
   */
  resolutionCap?: number;
  /** Multisampling. Cheap on a desktop GPU, not on a phone. */
  antialias?: boolean;
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
  performance?: PerformanceOptions;
}

/** Every field filled in — what the scene actually runs on. */
export type Resolved<T> = {
  [K in keyof T]-?: T[K] extends object | undefined
    ? Resolved<NonNullable<T[K]>>
    : NonNullable<T[K]>;
};

export type ResolvedOptions = Resolved<Required<PackOpenerOptions>>;
