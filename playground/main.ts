import {createPackOpener, resolveOptions} from '../src/core';
import type {PackOpenerInstance, PackOpenerOptions} from '../src/core';

/**
 * Playground for the pack-opening animation: every knob in the public schema,
 * wired live. It talks to `core` directly — no React — which is also the point:
 * the engine is framework-agnostic.
 */

type Control =
  | {kind: 'range'; path: string; label: string; min: number; max: number; step: number}
  | {kind: 'color'; path: string; label: string}
  | {kind: 'text'; path: string; label: string}
  | {
      kind: 'plain';
      path: string;
      label: string;
      placeholder: string;
      parse: (raw: string) => unknown;
      format: (value: unknown) => string;
    }
  | {kind: 'select'; path: string; label: string; options: string[]};

/** "Year: 2000, Grade: BGS 9.5" ⇄ the card's facts. */
const parseFacts = (raw: string) =>
  raw
    .split(',')
    .map(pair => {
      const [label, ...rest] = pair.split(':');
      return {label: label.trim(), value: rest.join(':').trim()};
    })
    .filter(fact => fact.label && fact.value);
const formatFacts = (value: unknown) =>
  Array.isArray(value)
    ? value.map((fact: {label: string; value: string}) => `${fact.label}: ${fact.value}`).join(', ')
    : '';

/**
 * `variants` marks a group as belonging to one mechanic: its numbers mean
 * nothing to the others, so showing them all at once would offer knobs that
 * quietly do nothing.
 */
const GROUPS: {title: string; variants?: string[]; controls: Control[]}[] = [
  {
    title: 'Mechanic',
    controls: [
      {kind: 'select', path: 'variant', label: 'Variant', options: ['slice', 'burst', 'carousel']},
    ],
  },
  {
    title: 'Assets',
    controls: [
      {kind: 'text', path: 'assets.pack.url', label: 'Pack image URL'},
      {kind: 'text', path: 'assets.card.url', label: 'Card image URL'},
    ],
  },
  {
    title: 'Theme',
    controls: [
      {kind: 'color', path: 'theme.glow', label: 'Rarity glow'},
      {kind: 'color', path: 'theme.beam', label: 'Beam'},
      {kind: 'color', path: 'theme.hint', label: 'Hint comet'},
      {kind: 'range', path: 'theme.cornerRadius', label: 'Card corner radius', min: 0, max: 40, step: 1},
    ],
  },
  {
    title: 'Motion',
    controls: [
      {kind: 'range', path: 'motion.speed', label: 'Speed ×', min: 0.25, max: 4, step: 0.05},
      {kind: 'range', path: 'motion.open.ms', label: 'Lid + slide out, ms', min: 300, max: 2500, step: 50},
      {kind: 'range', path: 'motion.reveal.holdMs', label: 'Hold before revealed, ms', min: 0, max: 3000, step: 50},
      {kind: 'select', path: 'motion.reveal.beamStyle', label: 'Beam style', options: ['segments', 'ribbon']},
    ],
  },
  {
    title: 'Interaction',
    variants: ['slice'],
    controls: [
      {kind: 'range', path: 'interaction.activation', label: 'Activation, px', min: 0, max: 60, step: 1},
      {kind: 'range', path: 'interaction.completeFraction', label: 'Commit at, share of width', min: 0.2, max: 0.95, step: 0.01},
      {kind: 'range', path: 'interaction.gapRatio', label: 'Cut gap', min: 0, max: 0.08, step: 0.002},
      {kind: 'range', path: 'interaction.edgeJitter', label: 'Ragged edge', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'interaction.band.top', label: 'Cut band top', min: 0, max: 0.6, step: 0.01},
      {kind: 'range', path: 'interaction.band.bottom', label: 'Cut band bottom', min: 0.2, max: 1, step: 0.01},
    ],
  },
  {
    title: 'Lid & wrapper',
    controls: [
      {kind: 'range', path: 'motion.open.lid', label: 'Lid share of timeline', min: 0.1, max: 0.9, step: 0.01},
      {kind: 'range', path: 'motion.open.lidThrowX', label: 'Lid throw sideways', min: 0, max: 2, step: 0.05},
      {kind: 'range', path: 'motion.open.lidThrowY', label: 'Lid throw up', min: 0, max: 2, step: 0.05},
      {kind: 'range', path: 'motion.open.lidSpin', label: 'Lid tumble, rad', min: -2, max: 2, step: 0.05},
      {kind: 'range', path: 'motion.open.cardFrom', label: 'Card starts at', min: 0.05, max: 0.9, step: 0.01},
      {kind: 'range', path: 'motion.open.sink', label: 'Wrapper sink', min: 0, max: 1.5, step: 0.05},
      {kind: 'range', path: 'motion.open.gone', label: 'Wrapper gone by', min: 0.2, max: 1, step: 0.01},
    ],
  },
  {
    title: 'Card & glows',
    controls: [
      {kind: 'range', path: 'motion.reveal.spinFlatness', label: 'Flat turn: edge-on thinness', min: 0.01, max: 0.4, step: 0.01},
      {kind: 'range', path: 'motion.reveal.spinShade', label: 'Flat turn: edge-on shading', min: 0, max: 0.5, step: 0.01},
      {kind: 'color', path: 'theme.rim', label: 'Rim'},
      {kind: 'color', path: 'theme.bloom', label: 'Bloom'},
      {kind: 'range', path: 'motion.reveal.haloAlpha', label: 'Halo opacity', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'motion.reveal.bloomAlpha', label: 'Bloom opacity', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'layout.glow.haloPadding', label: 'Halo reach, px', min: 0, max: 300, step: 4},
      {kind: 'range', path: 'layout.glow.haloSpread', label: 'Halo softness', min: 4, max: 160, step: 4},
      {kind: 'range', path: 'layout.glow.rimPadding', label: 'Rim reach, px', min: 0, max: 200, step: 4},
      {kind: 'range', path: 'layout.glow.bloomScaleX', label: 'Bloom width ×', min: 1, max: 6, step: 0.1},
      {kind: 'range', path: 'layout.glow.bloomScaleY', label: 'Bloom height ×', min: 1, max: 6, step: 0.1},
    ],
  },
  {
    title: 'Beam',
    controls: [
      {kind: 'range', path: 'motion.reveal.beamTail', label: 'Beam tail', min: 0.05, max: 1, step: 0.01},
      {kind: 'range', path: 'motion.reveal.beamWidth', label: 'Beam width, px', min: 1, max: 12, step: 0.5},
      {kind: 'range', path: 'motion.reveal.beamGlowWidth', label: 'Beam glow, px', min: 0, max: 40, step: 1},
      {kind: 'range', path: 'motion.reveal.beamGlowAlpha', label: 'Beam glow opacity', min: 0, max: 1, step: 0.02},
      {kind: 'range', path: 'motion.reveal.beamTipRadius', label: 'Beam tip, px', min: 0, max: 24, step: 1},
      {kind: 'color', path: 'theme.spark', label: 'Sparks, glints, embers'},
    ],
  },
  {
    title: 'Pack at rest',
    variants: ['slice'],
    controls: [
      {kind: 'range', path: 'slice.floatAmp', label: 'Float, pack heights', min: 0, max: 0.04, step: 0.001},
      {kind: 'range', path: 'slice.floatMs', label: 'Float, ms', min: 800, max: 8000, step: 100},
      {kind: 'range', path: 'slice.foilEveryMs', label: 'Foil glint every, ms', min: 1000, max: 10000, step: 100},
      {kind: 'range', path: 'slice.foilMs', label: 'Foil glint pass, ms', min: 200, max: 3000, step: 50},
      {kind: 'range', path: 'slice.foilAlpha', label: 'Foil glint opacity', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'slice.foilWidth', label: 'Foil glint width', min: 0.1, max: 1.5, step: 0.05},
      {kind: 'range', path: 'slice.foilTilt', label: 'Foil glint slant, rad', min: -1.2, max: 1.2, step: 0.02},
      {kind: 'range', path: 'slice.backlightAlpha', label: 'Backlight opacity', min: 0, max: 1, step: 0.02},
      {kind: 'range', path: 'slice.backlightSpread', label: 'Backlight reach, px', min: 4, max: 80, step: 1},
    ],
  },
  {
    title: 'The cut',
    variants: ['slice'],
    controls: [
      {kind: 'color', path: 'theme.seam', label: 'Light of the cut'},
      {kind: 'range', path: 'slice.bladeGlow', label: 'Hot point under the blade, px', min: 0, max: 80, step: 1},
      {kind: 'range', path: 'slice.bladeSparks', label: 'Blade sparks per px', min: 0, max: 1.5, step: 0.02},
      {kind: 'range', path: 'slice.sparkSpeed', label: 'Spark speed, px/s', min: 40, max: 1200, step: 10},
      {kind: 'range', path: 'slice.sparkLifeMs', label: 'Spark life, ms', min: 100, max: 1500, step: 10},
      {kind: 'range', path: 'slice.sparkSize', label: 'Spark size, px', min: 0.5, max: 6, step: 0.1},
      {kind: 'range', path: 'slice.sparkGravity', label: 'Spark gravity, px/s²', min: 0, max: 4000, step: 50},
      {kind: 'range', path: 'slice.burstSparks', label: 'Sparks when the seal gives', min: 0, max: 200, step: 2},
      {kind: 'range', path: 'slice.joltScale', label: 'Pack jolt', min: 0, max: 0.12, step: 0.005},
      {kind: 'range', path: 'slice.pourAlpha', label: 'Light out of the pack', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'slice.riseBloom', label: 'Rising card bloom', min: 0, max: 1, step: 0.05},
    ],
  },
  {
    title: 'Card turn',
    variants: ['slice'],
    controls: [
      {kind: 'range', path: 'slice.chargeMs', label: 'Charge, ms', min: 0, max: 3000, step: 50},
      {kind: 'range', path: 'slice.chargeLaps', label: 'Beam laps', min: 0, max: 5, step: 0.1},
      {kind: 'range', path: 'slice.chargeHalo', label: 'Halo while charging', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'slice.emblemAlpha', label: 'Star on the back', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'slice.tiltDeg', label: 'Sway, °', min: 0, max: 25, step: 0.5},
      {kind: 'range', path: 'slice.tiltMs', label: 'Sway, ms', min: 400, max: 6000, step: 100},
      {kind: 'range', path: 'slice.tremble', label: 'Tremble, px', min: 0, max: 8, step: 0.1},
      {kind: 'range', path: 'slice.flipMs', label: 'Flip, ms', min: 150, max: 2000, step: 10},
      {kind: 'range', path: 'slice.flipLift', label: 'Flip comes forward', min: 0, max: 0.5, step: 0.01},
      {kind: 'range', path: 'slice.flipRise', label: 'Flip rises', min: 0, max: 0.3, step: 0.01},
      {kind: 'range', path: 'slice.flipFlare', label: 'Edge-on flare', min: 0, max: 3, step: 0.05},
      {kind: 'range', path: 'slice.focal', label: 'Lens, card heights', min: 1, max: 12, step: 0.1},
      {kind: 'range', path: 'slice.landMs', label: 'Landing, ms', min: 200, max: 2000, step: 10},
      {kind: 'range', path: 'slice.landPunch', label: 'Landing push', min: 0, max: 0.3, step: 0.01},
      {kind: 'range', path: 'slice.landShake', label: 'Landing knock, px', min: 0, max: 24, step: 0.5},
      {kind: 'range', path: 'slice.twinkles', label: 'Glints', min: 0, max: 16, step: 1},
      {kind: 'range', path: 'slice.twinkleSize', label: 'Glint size, px', min: 4, max: 90, step: 1},
      {kind: 'range', path: 'slice.twinkleMs', label: 'Glint, ms', min: 80, max: 1000, step: 10},
      {kind: 'range', path: 'slice.embers', label: 'Embers', min: 0, max: 120, step: 1},
      {kind: 'range', path: 'slice.emberMs', label: 'Embers, ms', min: 300, max: 6000, step: 100},
      {kind: 'range', path: 'slice.emberSize', label: 'Ember size, px', min: 0.5, max: 8, step: 0.1},
      {kind: 'range', path: 'slice.emberRise', label: 'Embers rise, card heights', min: 0, max: 3, step: 0.05},
      {kind: 'range', path: 'slice.emberAlpha', label: 'Ember opacity', min: 0, max: 1, step: 0.05},
    ],
  },
  {
    title: 'Layout',
    controls: [
      {kind: 'range', path: 'layout.stage.reserveTop', label: 'Kept for the host, top, px', min: 0, max: 400, step: 4},
      {kind: 'range', path: 'layout.stage.reserveBottom', label: 'Kept for the host, bottom, px', min: 0, max: 400, step: 4},
      {kind: 'select', path: 'layout.pack.anchor', label: 'Pack sits', options: ['stage', 'card']},
      {kind: 'select', path: 'layout.card.spinAt', label: 'Card turns at', options: ['rest', 'pack']},
      {kind: 'range', path: 'layout.pack.widthRatio', label: 'Pack width / stage', min: 0.3, max: 1, step: 0.01},
      {kind: 'range', path: 'layout.pack.heightRatio', label: 'Pack height / stage', min: 0.3, max: 1, step: 0.01},
      {kind: 'range', path: 'layout.pack.offsetY', label: 'Pack offset down', min: -0.3, max: 0.3, step: 0.01},
      {kind: 'range', path: 'layout.card.heightRatio', label: 'Card height / pack', min: 0.4, max: 1.4, step: 0.01},
      {kind: 'range', path: 'layout.card.packWidthRatio', label: 'Card width / pack', min: 0.3, max: 1.2, step: 0.01},
      {kind: 'range', path: 'layout.card.maxRatio', label: 'Card widest ratio', min: 0.4, max: 2.5, step: 0.02},
    ],
  },
  {
    title: 'Hint & auto cut',
    controls: [
      {kind: 'range', path: 'hint.lineRatio', label: 'Hint line', min: 0, max: 0.6, step: 0.01},
      {kind: 'range', path: 'hint.sweep', label: 'Hint sweep', min: 0.2, max: 1, step: 0.01},
      {kind: 'range', path: 'hint.tail', label: 'Hint tail', min: 0, max: 1, step: 0.02},
      {kind: 'range', path: 'hint.headRadius', label: 'Hint head, px', min: 1, max: 24, step: 1},
      {kind: 'range', path: 'hint.tailAlpha', label: 'Hint tail opacity', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'hint.tailFalloff', label: 'Hint tail falloff', min: 0.5, max: 4, step: 0.1},
      {kind: 'range', path: 'hint.loopMs', label: 'Hint loop, ms', min: 400, max: 4000, step: 100},
      {kind: 'range', path: 'hint.idleMs', label: 'Hint pause, ms', min: 0, max: 3000, step: 100},
      {kind: 'range', path: 'interaction.autoArc.fromY', label: 'Auto cut starts at', min: 0, max: 0.8, step: 0.01},
      {kind: 'range', path: 'interaction.autoArc.controlY', label: 'Auto cut bend', min: -0.2, max: 0.8, step: 0.01},
    ],
  },
];

const BURST_GROUPS: {title: string; variants?: string[]; controls: Control[]}[] = [
  {
    title: 'Charge',
    variants: ['burst'],
    controls: [
      {kind: 'range', path: 'charge.holdMs', label: 'Full charge, ms', min: 300, max: 4000, step: 50},
      {kind: 'range', path: 'charge.releaseMs', label: 'Bleed off, ms', min: 80, max: 1200, step: 20},
      {kind: 'range', path: 'charge.shake', label: 'Shudder, pack heights', min: 0, max: 0.04, step: 0.001},
      {kind: 'range', path: 'charge.shakeHz', label: 'Shudder, Hz', min: 4, max: 40, step: 1},
      {kind: 'range', path: 'charge.squeeze', label: 'Squeeze', min: 0, max: 0.15, step: 0.005},
      {kind: 'range', path: 'charge.heatAlpha', label: 'Heat', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'charge.haloAlpha', label: 'Halo', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'charge.bloomAlpha', label: 'Bloom', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'charge.arcWidth', label: 'Progress arc, px', min: 0, max: 12, step: 0.5},
      {kind: 'range', path: 'charge.arcAlpha', label: 'Progress arc alpha', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'charge.sparks', label: 'Inbound sparks', min: 0, max: 60, step: 1},
      {kind: 'range', path: 'charge.sparkReach', label: 'Spark reach', min: 0, max: 2, step: 0.05},
      {kind: 'range', path: 'charge.sparkSize', label: 'Spark size, px', min: 0.5, max: 10, step: 0.5},
      {kind: 'range', path: 'charge.breathe', label: 'Idle breath', min: 0, max: 0.05, step: 0.002},
      {kind: 'range', path: 'charge.breatheMs', label: 'Idle breath, ms', min: 800, max: 6000, step: 100},
    ],
  },
  {
    title: 'Burst',
    variants: ['burst'],
    controls: [
      {kind: 'range', path: 'burst.flashMs', label: 'Flash, ms', min: 60, max: 800, step: 10},
      {kind: 'range', path: 'burst.flashScale', label: 'Flash reach', min: 1, max: 5, step: 0.1},
      {kind: 'range', path: 'burst.beatMs', label: 'Beat before card, ms', min: 0, max: 700, step: 10},
      {kind: 'range', path: 'burst.cols', label: 'Shards across', min: 2, max: 16, step: 1},
      {kind: 'range', path: 'burst.rows', label: 'Shards down', min: 2, max: 26, step: 1},
      {kind: 'range', path: 'burst.shapeJitter', label: 'Cut skew', min: 0, max: 0.45, step: 0.01},
      {kind: 'range', path: 'burst.shapeSegments', label: 'Tears per edge', min: 1, max: 6, step: 1},
      {kind: 'range', path: 'burst.shapeRagged', label: 'Tear depth', min: 0, max: 0.3, step: 0.01},
      {kind: 'range', path: 'burst.scatter', label: 'Speed scatter', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.lifeScatter', label: 'Lifetime scatter', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.glowFrom', label: 'Shards glow from', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.glowSwell', label: 'Shard flare', min: 0, max: 4, step: 0.1},
      {kind: 'range', path: 'burst.shardMs', label: 'Shreds live, ms', min: 150, max: 2000, step: 10},
      {kind: 'range', path: 'burst.spread', label: 'Throw', min: 0.2, max: 3, step: 0.05},
      {kind: 'range', path: 'burst.lift', label: 'Lift', min: -1, max: 2, step: 0.05},
      {kind: 'range', path: 'burst.gravity', label: 'Gravity', min: 0, max: 8, step: 0.1},
      {kind: 'range', path: 'burst.spin', label: 'Tumble', min: 0, max: 10, step: 0.1},
      {kind: 'range', path: 'burst.fadeFrom', label: 'Fade from', min: 0, max: 0.95, step: 0.05},
    ],
  },
  {
    title: 'Blast effects',
    variants: ['burst'],
    controls: [
      {kind: 'range', path: 'burst.spikes', label: 'Light spikes', min: 0, max: 40, step: 1},
      {kind: 'range', path: 'burst.spikeMs', label: 'Spikes, ms', min: 100, max: 1500, step: 20},
      {kind: 'range', path: 'burst.spikeLength', label: 'Spike length', min: 0.2, max: 4, step: 0.1},
      {kind: 'range', path: 'burst.spikeWidth', label: 'Spike width, px', min: 1, max: 24, step: 0.5},
      {kind: 'range', path: 'burst.spikeAlpha', label: 'Spike alpha', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.rings', label: 'Shock rings', min: 0, max: 6, step: 1},
      {kind: 'range', path: 'burst.ringMs', label: 'Ring, ms', min: 150, max: 2000, step: 20},
      {kind: 'range', path: 'burst.ringStagger', label: 'Ring gap', min: 0, max: 1, step: 0.02},
      {kind: 'range', path: 'burst.ringThickness', label: 'Front band', min: 0.05, max: 0.8, step: 0.01},
      {kind: 'range', path: 'burst.ringRagged', label: 'Front raggedness', min: 0, max: 0.4, step: 0.01},
      {kind: 'range', path: 'burst.ringSquash', label: 'Front flatten', min: 0, max: 0.6, step: 0.02},
      {kind: 'range', path: 'burst.ringAlpha', label: 'Front alpha', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.ringCoreAlpha', label: 'Front hot edge', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.ringReach', label: 'Front reach', min: 0.2, max: 4, step: 0.05},
      {kind: 'range', path: 'burst.flareMs', label: 'Flare, ms', min: 120, max: 1600, step: 20},
      {kind: 'range', path: 'burst.flareSpread', label: 'Flare spindles', min: 0.3, max: 2, step: 0.05},
      {kind: 'range', path: 'burst.flareReach', label: 'Flare reach', min: 0.3, max: 3, step: 0.05},
      {kind: 'range', path: 'burst.flareAlpha', label: 'Flare alpha', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.flareSpin', label: 'Flare turn', min: -2, max: 2, step: 0.05},
      {kind: 'range', path: 'burst.kickMs', label: 'Shake, ms', min: 0, max: 1200, step: 20},
      {kind: 'range', path: 'burst.kickAmp', label: 'Shake throw', min: 0, max: 0.12, step: 0.005},
      {kind: 'range', path: 'burst.kickHz', label: 'Shake rate', min: 2, max: 30, step: 1},
      {kind: 'range', path: 'burst.screenFlashMs', label: 'White-out, ms', min: 0, max: 600, step: 10},
      {kind: 'range', path: 'burst.screenFlashAlpha', label: 'White-out alpha', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.debris', label: 'Debris streaks', min: 0, max: 220, step: 5},
      {kind: 'range', path: 'burst.debrisMs', label: 'Debris, ms', min: 200, max: 3000, step: 50},
      {kind: 'range', path: 'burst.debrisSpread', label: 'Debris reach', min: 0.2, max: 4, step: 0.05},
      {kind: 'range', path: 'burst.debrisSize', label: 'Debris size, px', min: 0.5, max: 10, step: 0.2},
      {kind: 'range', path: 'burst.debrisTrail', label: 'Debris trail', min: 0, max: 4, step: 0.1},
      {kind: 'range', path: 'burst.debrisAlpha', label: 'Debris alpha', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.debrisGravity', label: 'Debris gravity', min: 0, max: 3, step: 0.05},
      {kind: 'range', path: 'burst.glitter', label: 'Glitter', min: 0, max: 200, step: 5},
      {kind: 'range', path: 'burst.glitterMs', label: 'Glitter, ms', min: 300, max: 6000, step: 100},
      {kind: 'range', path: 'burst.glitterSize', label: 'Glitter size, px', min: 0.5, max: 8, step: 0.2},
      {kind: 'range', path: 'burst.glitterAlpha', label: 'Glitter alpha', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.glitterFall', label: 'Glitter drift', min: -1, max: 2, step: 0.05},
    ],
  },
  {
    title: 'Card assembly',
    variants: ['burst'],
    controls: [
      {kind: 'range', path: 'burst.swarmMs', label: 'Dust cloud, ms', min: 100, max: 2000, step: 20},
      {kind: 'range', path: 'burst.dustMotes', label: 'Dust motes', min: 0, max: 140, step: 2},
      {kind: 'range', path: 'burst.dustSize', label: 'Mote size, px', min: 0.5, max: 10, step: 0.5},
      {kind: 'range', path: 'burst.dustAlpha', label: 'Dust alpha', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.dustBloomAlpha', label: 'Dust bloom', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.assembleMs', label: 'Assemble, ms', min: 200, max: 3000, step: 20},
      {kind: 'range', path: 'burst.assembleCols', label: 'Pieces across', min: 2, max: 16, step: 1},
      {kind: 'range', path: 'burst.assembleRows', label: 'Pieces down', min: 2, max: 22, step: 1},
      {kind: 'range', path: 'burst.assembleSpread', label: 'Start distance', min: 0.1, max: 2.5, step: 0.05},
      {kind: 'range', path: 'burst.assembleStagger', label: 'Stagger', min: 0, max: 0.9, step: 0.05},
      {kind: 'range', path: 'burst.assembleSpin', label: 'Piece tumble', min: 0, max: 8, step: 0.1},
      {kind: 'range', path: 'burst.assembleScaleFrom', label: 'Piece starts at', min: 0.1, max: 1.5, step: 0.05},
      {kind: 'range', path: 'burst.tintFrom', label: 'Tint drains from', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.handoverFrom', label: 'Card comes up from', min: 0.2, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.snapMs', label: 'Landing, ms', min: 60, max: 900, step: 10},
      {kind: 'range', path: 'burst.dissolveSpan', label: 'Pieces dissolve over', min: 0.1, max: 1, step: 0.05},
      {kind: 'range', path: 'burst.snapOvershoot', label: 'Landing push', min: 0, max: 0.25, step: 0.01},
      {kind: 'range', path: 'motion.reveal.pulseRim', label: 'Rim swell', min: 0, max: 2, step: 0.05},
      {kind: 'range', path: 'motion.reveal.pulseHalo', label: 'Halo swell', min: 0, max: 2, step: 0.05},
      {kind: 'range', path: 'motion.reveal.pulseSpread', label: 'Glow spread', min: 0, max: 0.3, step: 0.01},
      {kind: 'range', path: 'motion.reveal.sheenMs', label: 'Sheen, ms', min: 150, max: 1600, step: 20},
      {kind: 'range', path: 'motion.reveal.sheenAlpha', label: 'Sheen alpha', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'motion.reveal.sheenWidth', label: 'Sheen width', min: 0.1, max: 1.5, step: 0.05},
      {kind: 'range', path: 'motion.reveal.sheenTilt', label: 'Sheen tilt', min: -1, max: 1, step: 0.05},
    ],
  },
];

const CAROUSEL_GROUPS: {title: string; variants?: string[]; controls: Control[]}[] = [
  {
    title: 'Carousel',
    variants: ['carousel'],
    controls: [
      {kind: 'range', path: 'carousel.copies', label: 'Copies on the ring', min: 1, max: 9, step: 1},
      {kind: 'range', path: 'carousel.radius', label: 'Radius, pack widths', min: 0.5, max: 2.5, step: 0.05},
      {kind: 'range', path: 'carousel.gather', label: 'Gathered to the front', min: 0, max: 0.9, step: 0.01},
      {kind: 'range', path: 'carousel.turn', label: 'Copies turn with the ring', min: 0, max: 1.2, step: 0.01},
      {kind: 'range', path: 'carousel.focal', label: 'Lens, pack widths', min: 1, max: 8, step: 0.1},
      {kind: 'range', path: 'carousel.eye', label: 'Eye height, pack heights', min: 0, max: 1.5, step: 0.01},
      {kind: 'range', path: 'carousel.fade', label: 'Edge-on fade', min: 0.05, max: 1, step: 0.01},
      {kind: 'range', path: 'carousel.shade', label: 'Turned-away shade', min: 0, max: 1, step: 0.01},
      {kind: 'range', path: 'carousel.hoverAmp', label: 'Hover, pack heights', min: 0, max: 0.1, step: 0.005},
      {kind: 'range', path: 'carousel.hoverMs', label: 'Hover beat, ms', min: 800, max: 8000, step: 100},
      {kind: 'range', path: 'carousel.driftDps', label: 'Idle drift, °/s', min: 0, max: 30, step: 0.5},
      {kind: 'range', path: 'carousel.shuffleTurns', label: 'Shuffle, whole turns', min: 0, max: 3, step: 1},
      {kind: 'range', path: 'carousel.shuffleMs', label: 'Shuffle, ms', min: 300, max: 4000, step: 50},
      {kind: 'range', path: 'carousel.dragTurn', label: 'Drag: turns per pack width', min: 0.05, max: 0.6, step: 0.01},
      {kind: 'range', path: 'carousel.settleMs', label: 'Settle, ms', min: 100, max: 2000, step: 10},
      {kind: 'range', path: 'carousel.dropMs', label: 'Drop, ms', min: 60, max: 1000, step: 10},
      {kind: 'range', path: 'carousel.riseMs', label: 'Rise, ms', min: 100, max: 1500, step: 10},
      {kind: 'range', path: 'carousel.riseScale', label: 'Held pack grows to', min: 1, max: 3.5, step: 0.05},
      {kind: 'range', path: 'carousel.floatAmp', label: 'Float bob', min: 0, max: 0.05, step: 0.001},
      {kind: 'range', path: 'carousel.floatMs', label: 'Float bob, ms', min: 800, max: 6000, step: 100},
      {kind: 'range', path: 'carousel.reflectionAlpha', label: 'Floor reflection', min: 0, max: 1, step: 0.02},
      {kind: 'range', path: 'carousel.reflectionHeight', label: 'Reflection height', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'carousel.reflectionGap', label: 'Reflection gap, pack heights', min: 0, max: 0.3, step: 0.005},
    ],
  },
  {
    title: 'Story',
    variants: ['carousel'],
    controls: [
      {
        kind: 'plain',
        path: 'assets.card.facts',
        label: 'Facts',
        placeholder: 'Year: 2000, Category: Football, Grade: BGS 9.5',
        parse: parseFacts,
        format: formatFacts,
      },
      {
        kind: 'plain',
        path: 'assets.card.badge.label',
        label: 'Tier badge (empty = none)',
        placeholder: 'Mythic',
        parse: raw => raw.trim() || undefined,
        format: value => (value == null ? '' : String(value)),
      },
      {kind: 'color', path: 'assets.card.badge.color', label: 'Badge colour'},
      {kind: 'range', path: 'carousel.dissolveMs', label: 'Pack dissolves, ms', min: 100, max: 1500, step: 10},
      {kind: 'range', path: 'carousel.factMs', label: 'A fact fades in, ms', min: 100, max: 1500, step: 10},
      {kind: 'range', path: 'carousel.factGapMs', label: 'Between facts, ms', min: 0, max: 2000, step: 10},
      {kind: 'range', path: 'carousel.bannerMs', label: 'Banner slides in, ms', min: 200, max: 2500, step: 10},
      {kind: 'range', path: 'carousel.bannerHoldMs', label: 'Banner holds, ms', min: 0, max: 4000, step: 10},
      {kind: 'range', path: 'carousel.bannerTilt', label: 'Banner tilt, °', min: -45, max: 45, step: 1},
      {kind: 'range', path: 'carousel.flipMs', label: 'Flip, ms', min: 200, max: 2000, step: 10},
    ],
  },
];

GROUPS.push(...BURST_GROUPS, ...CAROUSEL_GROUPS);

/** Stand-in artwork so the playground works with no assets at hand. */
function placeholder(w: number, h: number, label: string, from: string, to: string) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold ${Math.round(w / 9)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, w / 2, h / 2);
  return canvas.toDataURL();
}

const DEFAULTS = {
  pack: placeholder(620, 900, 'PACK', '#2b4c9b', '#8b1e3f'),
  card: placeholder(420, 640, 'CARD', '#f4f6ff', '#c9d2f0'),
};

const options: PackOpenerOptions = {
  assets: {
    pack: {url: DEFAULTS.pack},
    // A story for the carousel to tell; the other mechanics ignore it
    card: {
      url: DEFAULTS.card,
      facts: [
        {label: 'Year', value: '2000'},
        {label: 'Category', value: 'Football'},
        {label: 'Grade', value: 'BGS 9.5'},
      ],
      badge: {label: 'Mythic', color: '#f5d000'},
    },
  },
};

// The panel opens on the preset's own values, and each mechanic has its own
// preset — so this is re-resolved whenever the variant changes
let resolvedPreview = resolveOptions({assets: {pack: {url: ''}}});

const get = (path: string): unknown =>
  path.split('.').reduce<any>((node, key) => (node == null ? node : node[key]), options);

const set = (path: string, value: unknown) => {
  const keys = path.split('.');
  const last = keys.pop()!;
  let node: any = options;
  for (const key of keys) {
    node[key] = node[key] ?? {};
    node = node[key];
  }
  node[last] = value;
};

const stage = document.querySelector<HTMLElement>('#stage')!;
const log = document.querySelector<HTMLOListElement>('#log')!;

let instance: PackOpenerInstance | null = null;
let generation = 0;

function note(text: string) {
  const li = document.createElement('li');
  li.textContent = text;
  log.prepend(li);
  while (log.children.length > 40) {
    log.lastElementChild?.remove();
  }
}

async function mount() {
  const mine = ++generation;
  instance?.destroy();
  instance = null;
  stage.replaceChildren();

  try {
    const created = await createPackOpener(stage, options, {
      onEvent: event => {
        const extra =
          event.type === 'tick' ? ` ${Number(event.progress).toFixed(2)}` : '';
        note(`${event.type}${extra}`);
      },
    });
    if (mine !== generation) {
      created.destroy();
      return;
    }
    instance = created;
  } catch (error) {
    note(`failed: ${String((error as Error)?.message || error)}`);
  }
}

// Applied to the running scene, so dragging a slider does not restart the
// ceremony; if the change needs a new scene the engine says so and we remount,
// and if it is waiting on a reset (the ceremony has played out) we reset, so
// every change is seen at once.
let pending: number | undefined;
const apply = () => {
  window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    const result = instance?.setOptions(options);
    if (!instance || result === 'scene') {
      void mount();
    } else if (result === 'deferred') {
      instance.reset();
    }
  }, 120);
};

function buildPanel() {
  const host = document.querySelector<HTMLElement>('#controls')!;
  host.replaceChildren();
  const variant = options.variant ?? 'slice';

  for (const group of GROUPS) {
    if (group.variants && !group.variants.includes(variant)) {
      continue;
    }
    const section = document.createElement('div');
    section.className = 'group';
    const title = document.createElement('h2');
    title.textContent = group.title;
    section.append(title);

    for (const control of group.controls) {
      const label = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = control.label;
      label.append(name);

      if (control.kind === 'select') {
        const input = document.createElement('select');
        for (const value of control.options) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          input.append(option);
        }
        input.value = String(get(control.path) ?? control.options[0]);
        input.addEventListener('change', () => {
          set(control.path, input.value);
          // A mechanic brings its own preset and its own knobs, so the panel
          // is rebuilt around it rather than left offering the old ones
          for (const key of ['interaction', 'hint', 'slice', 'charge', 'burst', 'carousel']) {
            delete (options as Record<string, unknown>)[key];
          }
          resolvedPreview = resolveOptions({
            variant: input.value as never,
            assets: {pack: {url: ''}},
          });
          buildPanel();
          apply();
        });
        label.append(input);
      } else if (control.kind === 'range') {
        const value = document.createElement('span');
        value.className = 'value';
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(control.min);
        input.max = String(control.max);
        input.step = String(control.step);
        const current = Number(get(control.path) ?? resolvedDefault(control.path));
        input.value = String(current);
        value.textContent = String(current);
        input.addEventListener('input', () => {
          value.textContent = input.value;
          set(control.path, Number(input.value));
          apply();
        });
        label.append(value, input);
      } else if (control.kind === 'color') {
        const input = document.createElement('input');
        input.type = 'color';
        // A colour the preset does not set (the badge's) starts on the glow
        input.value = String(get(control.path) ?? (resolvedDefault(control.path) || '#f5d000'));
        input.addEventListener('input', () => {
          set(control.path, input.value);
          apply();
        });
        label.append(input);
      } else if (control.kind === 'plain') {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = control.placeholder;
        input.value = control.format(get(control.path));
        input.addEventListener('change', () => {
          set(control.path, control.parse(input.value));
          apply();
        });
        label.append(input);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'https://…  (empty = built-in placeholder)';
        input.addEventListener('change', () => {
          const url = input.value.trim();
          set(
            control.path,
            url || (control.path.includes('pack') ? DEFAULTS.pack : DEFAULTS.card),
          );
          apply();
        });
        label.append(input);
      }

      section.append(label);
    }
    host.append(section);
  }
}

/** Sliders need a starting number even before the host has set one. */
function resolvedDefault(path: string): number | string {
  return (
    path.split('.').reduce<any>((node, key) => node?.[key], resolvedPreview) ?? 0
  );
}

document.querySelector('#replay')!.addEventListener('click', () => instance?.reset());
document.querySelector('#auto')!.addEventListener('click', () => instance?.autoSlice());
document.querySelector('#shuffle')!.addEventListener('click', () => instance?.shuffle());

buildPanel();
mount();
