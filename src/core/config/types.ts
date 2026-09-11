/**
 * Public option surface of the package. Everything a host may tune lives here;
 * anything not passed falls back to the chosen preset.
 *
 * Two levels on purpose: `variant` picks the animation mechanic (its own scene
 * module), `preset` picks a set of numbers for that mechanic. New styles arrive
 * as new variants, new looks as new presets — neither changes this shape.
 */
export type VariantName = 'slice' | 'burst';

export type PresetName = 'classic' | 'charged';

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
  /**
   * The card's own flourish: how far its rim and halo swell on a pulse, how
   * much wider the glows grow with it, and the highlight that runs across the
   * artwork — its length, brightness, width in card widths and its tilt.
   */
  pulseRim?: number;
  pulseHalo?: number;
  pulseSpread?: number;
  sheenMs?: number;
  sheenAlpha?: number;
  sheenWidth?: number;
  sheenTilt?: number;
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

/**
 * `burst` only: the pack is charged under a finger instead of being cut. The
 * charge is a clock, not a distance — the finger stays put and the pressure
 * builds, which is the whole difference in feel from `slice`.
 */
export interface ChargeOptions {
  /** How long a finger has to stay down for a full charge. */
  holdMs?: number;
  /** The charge bleeding away after a finger leaves early. */
  releaseMs?: number;
  /** Shudder at full charge, in pack heights, and how fast it shakes. */
  shake?: number;
  shakeHz?: number;
  /** How much the pack squeezes as the pressure builds, in pack widths. */
  squeeze?: number;
  /**
   * The three lights of a charged pack: heat added over the artwork itself, a
   * halo around its silhouette, and the bloom swelling behind it.
   */
  heatAlpha?: number;
  haloAlpha?: number;
  bloomAlpha?: number;
  /** The line that closes around the pack as the charge fills. */
  arcWidth?: number;
  arcAlpha?: number;
  /** Sparks pulled in from outside: how many, and how far out they start. */
  sparks?: number;
  sparkReach?: number;
  sparkSize?: number;
  /** How often the charge is reported back, as a share of it. */
  tickStep?: number;
  /** Breathing of an untouched pack: depth in pack widths, and its period. */
  breathe?: number;
  breatheMs?: number;
}

/** `burst` only: the wrapper coming apart and the card thrown out of it. */
export interface BurstOptions {
  /** The flash that covers the moment the wrapper stops existing. */
  flashMs?: number;
  /** How far the flash reaches past the pack, in pack widths. */
  flashScale?: number;
  /**
   * The beat between the flash and the card climbing out. Borrowed from slot
   * design, where the pause before the last reel stops is what makes the
   * result feel considered rather than rushed.
   */
  beatMs?: number;
  /**
   * Shards of foil. The artwork is re-cut into a mosaic — neighbours share the
   * points along the edge between them — so `cols` × `rows` decides how small
   * the pieces are and the `shape*` numbers decide how uneven they look. They
   * never decide whether the pieces meet: a grid of rectangles is what makes a
   * burst read as a photo cut with scissors, but pieces that do not interlock
   * leave the assembled card full of holes.
   */
  cols?: number;
  rows?: number;
  /** How far a grid node is pushed off true, in cells. */
  shapeJitter?: number;
  /** Segments an edge is torn into, and how deep the tear goes, in cells. */
  shapeSegments?: number;
  shapeRagged?: number;
  /** Per-shard speed and lifetime variation. 0 makes the grid legible again. */
  scatter?: number;
  lifeScatter?: number;
  shardMs?: number;
  /** How far they are thrown, in pack widths and heights. */
  spread?: number;
  lift?: number;
  /** How hard they fall, in pack heights per second squared, and how they spin. */
  gravity?: number;
  spin?: number;
  /** Share of a shard's life it spends fading out. */
  fadeFrom?: number;
  /** Share of its flight after which a shard burns as a spark, not as foil. */
  glowFrom?: number;
  /** How much a burning shard swells before it dies. */
  glowSwell?: number;

  /**
   * What the blast throws off besides the wrapper. All of it runs on one clock
   * from the moment the pack goes off and deliberately outlasts the beat that
   * follows, so the blast and the card's arrival read as one event.
   */
  /** Spikes of light out of the centre: how many, how long they live. */
  spikes?: number;
  spikeMs?: number;
  /** Their length in card half-diagonals, their thickness and opacity. */
  spikeLength?: number;
  spikeWidth?: number;
  spikeAlpha?: number;
  /** The front: how many waves, how long each takes, the gap between. */
  rings?: number;
  ringMs?: number;
  ringStagger?: number;
  /**
   * The band of one wave, as a share of its radius, and how far its outer edge
   * wanders off the circle — a thin, perfectly round wave reads as a diagram.
   * `ringSquash` flattens it, so it travels across a floor rather than on the
   * glass, and `ringCoreAlpha` is the hot white edge riding the coloured band.
   */
  ringThickness?: number;
  ringRagged?: number;
  ringSquash?: number;
  ringAlpha?: number;
  ringCoreAlpha?: number;
  /** How far a wave travels, in half-diagonals. */
  ringReach?: number;
  /**
   * The flare struck at the middle of the blast: how long it burns, how far
   * its spindles reach across their own texture and then on the stage, how
   * bright it is, and how far it turns while it burns.
   */
  flareMs?: number;
  flareSpread?: number;
  flareReach?: number;
  flareAlpha?: number;
  flareSpin?: number;
  /**
   * The hit: how long the stage is shaken for, how far it is thrown in pack
   * widths, and how fast it rattles. A blast the viewer watches is an
   * animation; one that moves the stage is an event.
   */
  kickMs?: number;
  kickAmp?: number;
  kickHz?: number;
  /** The white-out over the whole stage, and how bright it goes. */
  screenFlashMs?: number;
  screenFlashAlpha?: number;

  /** Debris thrown out as streaks: count, lifetime, reach, size, trail. */
  debris?: number;
  debrisMs?: number;
  debrisSpread?: number;
  debrisSize?: number;
  debrisTrail?: number;
  debrisAlpha?: number;
  /** How hard the debris falls, in pack heights over its lifetime. */
  debrisGravity?: number;
  /** Glitter left hanging in the air: count, lifetime, size, opacity, drift. */
  glitter?: number;
  glitterMs?: number;
  glitterSize?: number;
  glitterAlpha?: number;
  glitterFall?: number;

  /**
   * How the card arrives: not slid out of a wrapper but assembled. First a
   * cloud of dust gathers where the card will be — that is also where waiting
   * for late artwork hides — then it resolves into pieces of the artwork and
   * they fly into place.
   */
  swarmMs?: number;
  /** The waiting cloud: how many motes, how big, how bright, and its bloom. */
  dustMotes?: number;
  dustSize?: number;
  dustAlpha?: number;
  dustBloomAlpha?: number;
  /** The assembly: how long it takes and the grid the card is cut into. */
  assembleMs?: number;
  assembleCols?: number;
  assembleRows?: number;
  /** How far out the pieces start, in card heights. */
  assembleSpread?: number;
  /**
   * Share of the assembly spent staggering the pieces by distance from the
   * middle. 0 lands them all at once, which reads as one flat sheet.
   */
  assembleStagger?: number;
  /** How much a piece is turned and shrunk while it is still in flight. */
  assembleSpin?: number;
  assembleScaleFrom?: number;
  /**
   * Where a piece's rarity tint starts draining, as a share of its approach,
   * and where the finished card starts coming up underneath the assembly, as a
   * share of `assembleMs`. The hand-over is gradual on purpose: swapping the
   * pieces for the card in one frame is the one thing the eye always catches.
   */
  tintFrom?: number;
  handoverFrom?: number;
  /** The landing: a push out and back, and the light struck behind the card. */
  snapMs?: number;
  snapOvershoot?: number;
  /** Share of the snap over which the pieces dissolve off the finished card. */
  dissolveSpan?: number;

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
  charge?: ChargeOptions;
  burst?: BurstOptions;
}

/** Every field filled in — what the scene actually runs on. */
export type Resolved<T> = {
  [K in keyof T]-?: T[K] extends object | undefined
    ? Resolved<NonNullable<T[K]>>
    : NonNullable<T[K]>;
};

/**
 * What a scene runs on. The groups every mechanic shares are always filled in;
 * the ones that belong to a single mechanic are there only when that mechanic
 * is the one running, because a preset has no business carrying numbers for an
 * animation it is not.
 */
/** Groups that belong to one mechanic rather than to every scene. */
type VariantGroups = 'interaction' | 'hint' | 'charge' | 'burst';

export type ResolvedOptions = Resolved<
  Required<Omit<PackOpenerOptions, VariantGroups>>
> & {
  interaction?: Resolved<InteractionOptions>;
  hint?: Resolved<HintOptions>;
  charge?: Resolved<ChargeOptions>;
  burst?: Resolved<BurstOptions>;
};
