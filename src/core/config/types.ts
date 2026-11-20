/**
 * Public option surface of the package. Everything a host may tune lives here;
 * anything not passed falls back to the chosen preset.
 *
 * Two levels on purpose: `variant` picks the animation mechanic (its own scene
 * module), `preset` picks a set of numbers for that mechanic. New styles arrive
 * as new variants, new looks as new presets — neither changes this shape.
 */
export type VariantName = 'slice' | 'burst' | 'carousel' | 'climb';

export type PresetName = 'classic' | 'charged' | 'showcase' | 'spectrum';

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
    /**
     * What the card is, for a mechanic that says it before showing it
     * (`carousel` lists them one by one before the flip). Each is a label
     * and a value — `{label: 'Year', value: '2000'}` — in the order to show;
     * left out or empty, the mechanic skips straight to the flip. The host
     * usually only knows them once the backend has opened the pack, so they
     * tend to arrive through `setOptions` mid-ceremony, which is fine: they
     * are read when their moment comes, not when the scene is built.
     */
    facts?: {label: string; value: string}[];
    /**
     * The pull's tier, shouted on a banner across the card before the flip
     * (`carousel`). Left out, there is no banner — the tier is not one worth
     * shouting about. `color` is the banner's fill, usually the tier's colour.
     */
    badge?: {label: string; color?: Color};
  };
  /**
   * Stand the revealed card is shown above. Left out, the scene uses the one
   * baked into the package, so every host gets the same arrival.
   */
  pedestal?: {url?: string};
}

export interface ThemeOptions {
  /** Page behind the scene. `'transparent'` lets the host's own background through. */
  background?: Color | 'transparent';
  /** Halo that settles around the revealed card — usually the rarity colour. */
  glow?: Color;
  /** Thin light rim hugging the card silhouette. */
  rim?: Color;
  /** Soft radial bloom behind the card while it is still face down. */
  bloom?: Color;
  /** Beam that runs around the card outline. */
  beam?: Color;
  /** The white of the small lights: hot sparks, glints on the artwork, embers. */
  spark?: Color;
  /**
   * The light of the cut (`slice`): the sparks off the blade, the light
   * pouring out of the opened pack, the warm bloom behind the rising card.
   */
  seam?: Color;
  /** Comet that mimes the swipe before the first touch. */
  hint?: Color;
  /**
   * The card's back, top to bottom, plus its sheen. `line` engraves it with
   * fine cross-hatching and `emblem` prints a frame and a star in the middle;
   * `transparent` leaves either out, and with both out the back is a plain slab.
   */
  cardBack?: {
    top?: Color;
    mid?: Color;
    bottom?: Color;
    sheen?: Color;
    line?: Color;
    emblem?: Color;
  };
  /** Corner radius of the card, in css px. */
  cornerRadius?: number;
  /**
   * The family the badge's word behind the landed card is set in
   * (`motion.reveal.badgeWord`), as CSS names it. A web font works once the
   * host's page can load it; in the React Native WebView only the device's
   * own fonts are there, so keep a system family at the end.
   */
  badgeFont?: string;
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
    /** Fade-in of the stand under the card, once the card has landed. */
    pedestalMs?: number;
    /** The card sits still with its halo before the host takes over. */
    holdMs?: number;
    /** Length of the beam's tail, as a share of the outline. */
    beamTail?: number;
    /**
     * The flat turn (`carousel`): how thin the card gets edge-on — 0 is a
     * perfect edge and reads as a gap — how much darker its back goes there,
     * and the bloom while it turns, this at the edge and full face-on.
     */
    spinFlatness?: number;
    spinShade?: number;
    spinBloom?: number;
    /** Peak opacity of the three glows. */
    bloomAlpha?: number;
    rimAlpha?: number;
    haloAlpha?: number;
    /**
     * Whether the card's light — the three glows and the beam on its outline —
     * shows during a phase, by the name `onPhase` reports it (`slice`: open,
     * charge, chargeHold, flip, land, hold). A phase left out keeps it:
     * `{hold: false}` leaves the card at rest bare and plays everything before
     * it as it was. Once the ceremony is over, its last phase's choice stays.
     */
    glowDuring?: Partial<Record<string, boolean>>;
    /** How long the glows take to go out or come back between phases. */
    glowFadeMs?: number;
    /**
     * `slice`: while the card is face down its light keeps the pull's colour
     * to itself — each time the beam rounds a corner it takes another out of
     * `chargeCycleColors`, by chance, and the cycle ends on the pull's own at
     * the last corner before the card turns, so the colour the face shows is
     * the one it landed on. Off by default. Shows only where the glows
     * are on (`glowDuring` charge and chargeHold).
     */
    chargeCycle?: boolean;
    /** The colours the cycle picks from, as CSS strings. One is a steady, neutral light. */
    chargeCycleColors?: string[];
    /**
     * The pull's badge — `assets.card.badge`, its label in its colour — as a
     * giant outline word behind the card once it has landed (`slice`,
     * `burst`). Off by default; a pull without a badge gets no word, so the
     * host decides which tiers have one by passing it or not.
     */
    badgeWord?: boolean;
    /** The travelling beam: core line, the glow under it, and its bright tip. */
    beamWidth?: number;
    beamAlpha?: number;
    beamGlowWidth?: number;
    beamGlowAlpha?: number;
    beamTipRadius?: number;
    /** Segments the beam is drawn with, and corner detail of the path it runs. */
    beamSteps?: number;
    /**
     * How the beam is drawn. `segments` strokes it as short round-capped lines,
     * which read as a dotted trail once the card is large — a desktop stage.
     * `ribbon` lays one soft gradient along the outline, continuous at any
     * size. `segments` stays the default, so a host that has not asked for the
     * ribbon draws exactly what it drew before.
     */
    beamStyle?: 'segments' | 'ribbon';
    outlineDetail?: number;
    /** One turn of the card while it waits for late artwork (`carousel`). */
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
  /**
   * Bands of the stage the host keeps for its own UI — a title above the card,
   * buttons below it. The pack, and later the card with its stand, are centred
   * in what is left and shrink to fit it, instead of sliding under whatever
   * the host draws there. In css px.
   */
  stage?: {
    reserveTop?: number;
    reserveBottom?: number;
  };
  /**
   * Where the pack sits and how much of the stage it takes. `anchor: 'card'`
   * places the pack where the card will come to rest, so the cut does not
   * hoist the card up out of the pack's place; `stage` (the default) centres
   * it on the stage — or on the band the host left free — nudged by `offsetY`.
   */
  pack?: {
    /** Caps against the stage; the artwork's own aspect decides the rest. */
    widthRatio?: number;
    heightRatio?: number;
    /** Nudge down from the centre, in stage heights — leaves room for a hint. */
    offsetY?: number;
    anchor?: 'stage' | 'card';
  };
  /**
   * Card size relative to the pack. It has to read as something that came out
   * of the wrapper, so the width is capped against the pack, not the screen.
   * `spinAt: 'pack'` keeps the card where the pack was while it turns and
   * lifts it onto its stand as it lands; `rest` (the default) slides it
   * straight to its resting place. Slice only — burst assembles the card at
   * rest either way.
   * The aspect ratio is always kept — the cap moves both sides.
   */
  card?: {
    heightRatio?: number;
    packWidthRatio?: number;
    /**
     * The shape the card is built to while its artwork is still on its way;
     * once the artwork arrives the card is built again to its own shape, as
     * long as its face has not been shown yet.
     */
    aspect?: number;
    /**
     * Widest the card may get, whatever the artwork's ratio says — artwork
     * wider than this has its sides cut. High in every preset, so the card
     * takes the artwork's own shape.
     */
    maxRatio?: number;
    spinAt?: 'rest' | 'pack';
  };
  /**
   * The stand under the revealed card. The card hangs above it rather than
   * resting on it, so the gap is deliberate.
   */
  pedestal?: {
    /** Width of the stand relative to the card. */
    widthRatio?: number;
    /** Its height, relative to its own width. */
    aspect?: number;
    /** How far below the card's edge it starts, in card widths. */
    gapRatio?: number;
    /**
     * Air kept under the stand, in card widths. The pair is centred with it,
     * so whatever the host hangs below — a price, a button — is not crowded.
     */
    clearanceRatio?: number;
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
  /** Share of the pack width the streak travels — 1 is edge to edge. */
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

/**
 * `carousel` only: copies of the pack on a turntable, one of them tapped,
 * lifted and opened by being talked about — its facts, its tier — before it
 * flips into the card.
 */
export interface CarouselOptions {
  /** How many copies of the pack stand on the turntable. */
  copies?: number;
  /** Radius of the turntable, in pack widths: how far the copies stand from its axis. */
  radius?: number;
  /**
   * How the copies gather toward the front of the ring. 0 spaces them
   * evenly round it; more crowds the ones in view together, so the copies
   * either side of the front one turn less away from the viewer and show
   * wider, while the spacing round the back — where nothing is seen — opens
   * up to make room. Below 1.
   */
  gather?: number;
  /**
   * How far a copy turns to follow the ring: 1 stands it tangent, facing
   * straight out; less keeps it turned a little toward the viewer, so the
   * copies either side of the front one show more of their face.
   */
  turn?: number;
  /**
   * The eye's distance from the front copy, in pack widths: the perspective.
   * Short is a wide lens, the ring's far side small and the near copies
   * looming; long flattens it toward a row.
   */
  focal?: number;
  /**
   * How high the eye is above the floor the copies stand on, in pack
   * heights. Higher looks down onto the turntable more: the far copies'
   * feet climb the stage and the reflection is seen more from above.
   */
  eye?: number;
  /**
   * A copy edge-on is a flickering sliver: it is faded out over this share
   * of its full width either side of edge-on, and seen from behind past it.
   */
  fade?: number;
  /** How dark a copy gets as it turns away from the light on the front (0..1): the ones round the back get all of it. */
  shade?: number;
  /**
   * The copies hover: each rises and sinks a little on its own beat, in
   * pack heights and ms per beat. 0 amplitude stands them still.
   */
  hoverAmp?: number;
  hoverMs?: number;
  /** The turntable's idle drift, degrees per second; 0 stands still. */
  driftDps?: number;
  /**
   * A shuffle: the turntable spins this many extra turns and settles with a
   * different copy in front, over `shuffleMs`.
   */
  shuffleTurns?: number;
  shuffleMs?: number;
  /**
   * The finger turning the ring: how far it turns, in whole turns, for a
   * drag across one pack width; and how long it takes to settle on the
   * nearest copy once let go, coasting with the drag's momentum first.
   */
  dragTurn?: number;
  settleMs?: number;
  /** The tapped copy's fall off the turntable, and its neighbours fading out. */
  dropMs?: number;
  /** The chosen pack rising to centre stage, grown to this share of its stage size. */
  riseMs?: number;
  riseScale?: number;
  /** The pack floats while it waits for the second tap: bob amplitude (pack heights) and period. */
  floatAmp?: number;
  floatMs?: number;
  /** The pack dissolving once tapped, before the facts. */
  dissolveMs?: number;
  /** Each fact fading in, and the pause before the next. */
  factMs?: number;
  factGapMs?: number;
  /** The banner: its slide across, and how long it stays before the flip. */
  bannerMs?: number;
  bannerHoldMs?: number;
  /** The banner's tilt across the stage, in degrees. */
  bannerTilt?: number;
  /** The flip from the blank back to the card, and its landing pulse. */
  flipMs?: number;
  /** The floor's reflection of the packs: how strong, and how tall (pack heights). */
  reflectionAlpha?: number;
  reflectionHeight?: number;
  /** Floor showing between a pack and its reflection, in pack heights. */
  reflectionGap?: number;
}

/**
 * `climb` only: the whole purchase on one stage, as a grid of as many items
 * as packs were bought. Each starts as the pack itself, in its own
 * silhouette; they spin in changing colours, each on its own, stop one by
 * one on their tier's colour and turn into their cards — the ordinary ones
 * in grid order, the hits last and together.
 */
export interface ClimbOptions {
  /**
   * How many items: one stands alone and large; more stand in the columns
   * that show them largest on the stage they have — ten stand 4-4-2 on a
   * phone and 5-5 on a wide screen — every card the same shape, with room
   * under each for its price and tier.
   */
  count?: number;
  /**
   * The colours an item glows in while it spins, picked at random and never
   * the same twice running, so the spin gives nothing away. Lowest tier first.
   * Each is held for 0.31–0.58 of a turn — 280–520 ms at the preset's 900 ms
   * `spinMs` — so the colours keep pace with the spin: `spinMs`, and
   * `motion.speed` through it, sets how fast they change, and `setSpeed`
   * hurries them with the rest.
   */
  cycleColors?: string[];
  /** How far the artwork itself takes the colour, 0..1: 0 leaves it alone. */
  tint?: number;
  /**
   * How far a spinning pack is flooded with its colour as a coloured foil,
   * 0..1: the colour takes the artwork's shadows and lights, so the picture
   * shows through. 0 leaves the pack as it is (`tint` still applies).
   */
  flood?: number;
  /** A white flash over the stage as the hits turn. */
  flash?: boolean;
  /**
   * How hard the stage is shaken, 0..1 — 0 for not at all: by the pack
   * bursting into the grid, by the first card landing on its face, by the
   * hits as they come round and land, by every beat of the combo, and by the
   * host's own `shake()`. What shakes is the cards and what they throw off;
   * the prices, the tiers and the combo stand still, and so does the host's
   * page.
   */
  shake?: number;
  /**
   * What a card throws off as its face comes up — a pop of its light, a
   * burst in the style `reveal` names, glints, one band of sheen across it,
   * and a star at a hit's corner. Off, a card just turns.
   */
  sparkle?: boolean;
  /**
   * The style of that burst: `shatter` (the preset's) — the pack does not
   * turn: it bursts off its card in pieces of its own coloured foil, the
   * card punching up in its place, with the flare's light; `flare` — a ring of light and short rays in the
   * tier's colour, with stars; `motes` — soft glowing motes rising off the
   * card; `pixels` — small square sparks thrown out that drift up like the
   * dust behind the stage.
   */
  reveal?: 'shatter' | 'flare' | 'motes' | 'pixels';
  /**
   * Where the cards' prices gather once every card is up, in css px from the
   * stage's top (always in the middle of its width): the place the host
   * writes the total. Negative (the default), a little above the grid, in
   * the band the host keeps free over it (`layout.stage.reserveTop`).
   */
  gatherY?: number;
  /**
   * Dust behind the stage: small square motes, most of them white and the
   * rest in the reel's colours, thick at the foot of the stage and thinning
   * upward, rising all the time and shaken with the stage, the far ones less
   * than the near. While it rises the stage is drawn all the time, at
   * `performance.idleFps`, and never goes to sleep. Off, the stage has
   * nothing behind the items.
   */
  dust?: boolean;
  /**
   * The price under a turned card: what goes before and after the number, and
   * the decimals it keeps. Given, not looked up: the host's currency is not
   * always an ISO one.
   */
  price?: {prefix?: string; suffix?: string; decimals?: number};
  /**
   * The family the prices, the tiers under them and the combo are set in, as
   * CSS names it — the host's own, so the stage reads as its page does. A web
   * font works once the host's page has loaded it; keep a system family at
   * the end.
   */
  font?: string;
  /** The items arriving: one flies in from the centre and splits into `count`. */
  introMs?: number;
  /**
   * The turn the ceremony is paced by: a stop takes half of it, a
   * card turns over in half of it. On the reel itself an item turns one and
   * a half to two times as fast, each at a speed of its own, and takes a
   * fresh colour each time it stands edge-on.
   */
  spinMs?: number;
  /**
   * The shortest the reel spins, however early the cards arrive — counted
   * from the ceremony's start, the intro included. Each ceremony draws its
   * own length between this and `reelMaxMs`; Speed up shortens it.
   */
  reelMinMs?: number;
  /** The longest a ceremony's drawn reel may be (see `reelMinMs`); at or under it, every reel runs `reelMinMs`. */
  reelMaxMs?: number;
  /** Between one item stopping and the next, in grid order — closer on a big grid, all of them stopped within half a second. */
  stopStaggerMs?: number;
  /** Between one card turning and the next. */
  flipStaggerMs?: number;
  /** The pause before the hits turn. */
  hitHoldMs?: number;
  /** The combo's landing, and the wait before a card sold at purchase goes dark. (A price counts up in its own, fixed time.) */
  rollUpMs?: number;
}

/**
 * A card a climb item turns into. `color` is the one the item stops on — its
 * tier's; a `hit` waits for the others and turns with the hits, last;
 * `price` is written under it once it has turned — `null` or left out, no
 * price — over its `tier`'s name in the tier's light. A card `sold` already
 * (sold with the purchase) goes dark once its price is counted, `SOLD` in
 * place of its tier; one sold later is told with `markSold`.
 */
export interface ClimbCard {
  /**
   * The card's artwork — or a promise of its url, for a host that fetches
   * it itself: the items stop on their colours without waiting for it, and
   * the card waits for it only to turn.
   */
  url: string | Promise<string>;
  color: string;
  hit?: boolean;
  price?: number | null;
  tier?: string | null;
  sold?: boolean;
  /**
   * One of the cards the combo's words name — the hits of the tier it calls
   * out. The combo counts these out, one beat each, in their light. Unmarked,
   * the scene picks the hits of the colour standing highest in the palette
   * among those that came up twice or more.
   */
  combo?: boolean;
}

/** A box on the stage, in css px. */
export interface StageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where the revealed card and its stand come to rest, given outright — for
 * a host that lays its own chrome out around the card in the DOM and wants
 * the scene's card exactly where its own would be, whatever the layout's
 * rules would have worked out. Optional; without it the card rests where
 * `layout` puts it.
 */
export interface RestOptions {
  /**
   * The card's box. The artwork is fitted into it the way a contained image
   * is: by height when it is narrower than the box, by width when wider,
   * centred across and set on the box's bottom edge.
   */
  card?: StageRect;
  /**
   * The stand: where its bottom edge sits, how wide it is, and its left
   * edge. Its height follows its artwork's own ratio, as an image's would.
   */
  pedestal?: {left: number; width: number; bottom: number};
}

/**
 * `slice` only: the life of the pack and the light of the cut, and how the
 * card turns over. The untouched pack floats and catches the light; the cut
 * glows and throws sparks; the opened pack pours light; the card gathers
 * itself face down in its colour, turns over in perspective and lands.
 */
export interface SliceOptions {
  /** How far the untouched pack floats, in pack heights, and one float up and back. */
  floatAmp?: number;
  floatMs?: number;
  /**
   * Light crossing the foil while the pack waits: how often it comes round,
   * how long one pass takes, how bright it is, how wide in pack widths and
   * its slant in radians.
   */
  foilEveryMs?: number;
  foilMs?: number;
  foilAlpha?: number;
  foilWidth?: number;
  foilTilt?: number;
  /** Glow round the pack's own outline: opacity, and how far it reaches in css px. */
  backlightAlpha?: number;
  backlightSpread?: number;
  /** The hot point under the blade, css px across. */
  bladeGlow?: number;
  /**
   * Sparks: how many the blade throws per css px it travels, their speed in
   * px/s, life, size in css px, and the pull down on them in px/s².
   */
  bladeSparks?: number;
  sparkSpeed?: number;
  sparkLifeMs?: number;
  sparkSize?: number;
  sparkGravity?: number;
  /**
   * The seal giving: sparks thrown off the whole cut, and how hard the pack
   * jolts, as a share of its size.
   */
  burstSparks?: number;
  joltScale?: number;
  /** Light pouring out of the opened pack, and the warm bloom behind the rising card. */
  pourAlpha?: number;
  riseBloom?: number;
  /**
   * The card gathering itself face down: how long, one more loop of it for
   * as long as the artwork is late, the laps the beam makes, how full the
   * halo gets (a share of `haloAlpha`), how bright the star printed by
   * `theme.cardBack.emblem` burns (0 in `slice`, whose back is plain),
   * the sway in degrees and one sway in ms, and how hard it trembles at the
   * end, in css px.
   */
  chargeMs?: number;
  chargeWaitMs?: number;
  chargeLaps?: number;
  chargeHalo?: number;
  emblemAlpha?: number;
  tiltDeg?: number;
  tiltMs?: number;
  tremble?: number;
  /**
   * The turn: how long, how far the card comes up towards the eye (a share
   * of its size) and rises (card heights), how hard its light flares as the
   * edge passes, and the lens, in card heights.
   */
  flipMs?: number;
  flipLift?: number;
  flipRise?: number;
  flipFlare?: number;
  focal?: number;
  /**
   * The landing: how long, the push, how hard the stage knocks with it in
   * css px, and the glints that catch on the artwork — how many, their size
   * in css px and each one's life.
   */
  landMs?: number;
  landPunch?: number;
  landShake?: number;
  twinkles?: number;
  twinkleSize?: number;
  twinkleMs?: number;
  /**
   * Embers drifting up past the card once it is down: how many, over how
   * long, their size in css px, how high they rise in card heights, opacity.
   */
  embers?: number;
  emberMs?: number;
  emberSize?: number;
  emberRise?: number;
  emberAlpha?: number;
}

/**
 * The ceremony's sound: the foil under the finger, the lid coming off, the
 * sweep and the impact as the card lands, the carousel's clicks and chime —
 * scored on the scene's own events, played with Web Audio wherever the scene
 * runs. Off unless the host turns it on.
 */
/**
 * How the climb is scored: `impact` — a pause, then the blow (a deep pulse on the spin, a riser into the stop, a
 * glass pop per card, a boom under the hits); `arcade` — the machine (a ratchet, a clack per stop, a fanfare, a
 * shower of coins); `music` — every moment a note of one chord on a kalimba. The other mechanics have one score.
 */
export type SoundDesign = 'impact' | 'arcade' | 'music';

export interface SoundOptions {
  /** Off by default: a host that wants the ceremony heard says so. */
  enabled?: boolean;
  /** The master level, 0..1. */
  volume?: number;
  /**
   * The player's own mute. The score keeps its place in silence, so a mute
   * lifted mid-ceremony is heard from the next cue on.
   */
  muted?: boolean;
  /**
   * The pull's badge as the platform names it — Grail, Chase, Big Hit, Epic,
   * Rare — which decides how hard the landing hits. Read when the landing is
   * cued, so it may arrive with the card. Without it, `assets.card.badge`'s
   * label; without either, the landing of a common pull. The climb's hits,
   * the pack's top tier by construction, come round on an epic's stinger at
   * least, whatever it says.
   */
  badge?: string | null;
  /**
   * The host's own files for any of the score's cues, by cue name — a URL or
   * a `data:` URI each — laid over the baked ones. Read once, when sound is
   * first on; a file that will not load leaves the baked cue in place. In the
   * React Native WebView only `data:` URIs are sure to load.
   */
  samples?: Record<string, string>;
  /** The climb's score (`SoundDesign`), read at every cue; `impact` when not said. */
  design?: SoundDesign;
}

export interface PackOpenerOptions {
  variant?: VariantName;
  preset?: PresetName;
  assets: AssetOptions;
  theme?: ThemeOptions;
  motion?: MotionOptions;
  interaction?: InteractionOptions;
  layout?: LayoutOptions;
  rest?: RestOptions;
  hint?: HintOptions;
  performance?: PerformanceOptions;
  slice?: SliceOptions;
  charge?: ChargeOptions;
  burst?: BurstOptions;
  carousel?: CarouselOptions;
  climb?: ClimbOptions;
  sound?: SoundOptions;
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
type VariantGroups =
  | 'interaction'
  | 'hint'
  | 'slice'
  | 'charge'
  | 'burst'
  | 'carousel'
  | 'climb';

export type ResolvedOptions = Resolved<
  Required<Omit<PackOpenerOptions, VariantGroups | 'assets' | 'rest'>>
> & {
  /** Given by the host or not at all: nothing to fill in. */
  rest?: RestOptions;
  /**
   * Assets keep their optional facts and badge: they are the pull's, not the
   * scene's, and a pull may have none.
   */
  assets: {
    pack: {url: string};
    card: {
      url: string;
      timeoutMs: number;
      facts: {label: string; value: string}[];
      badge?: {label: string; color: Color};
    };
    pedestal: {url: string};
  };
  interaction?: Resolved<InteractionOptions>;
  hint?: Resolved<HintOptions>;
  slice?: Resolved<SliceOptions>;
  charge?: Resolved<ChargeOptions>;
  burst?: Resolved<BurstOptions>;
  carousel?: Resolved<CarouselOptions>;
  climb?: Resolved<ClimbOptions>;
};
