import type {ResolvedOptions} from '../../config/types';

/**
 * `charged` is the burst mechanic as designed: a finger holds the pack down,
 * the pressure builds for a beat over a second, and the wrapper goes off.
 *
 * Two timings here are deliberate rather than arbitrary. `charge.holdMs` is the
 * length of the anticipation — long enough to feel like something is being
 * loaded, short enough that a collector opening ten packs in a row does not
 * start resenting it. `burst.beatMs` is the pause between the flash and the
 * card: slot design leans on exactly that gap, and without it the reveal reads
 * as rushed even though nothing is missing from it.
 *
 * The reveal itself is shorter than `slice`'s on purpose — the charge already
 * spent the audience's patience on suspense, so the spin does not need to.
 */
export const PRESETS: Record<
  'charged',
  Omit<ResolvedOptions, 'variant' | 'preset' | 'assets' | 'interaction' | 'hint'>
> = {
  charged: {
    theme: {
      background: 'transparent',
      glow: '#9a6bff',
      rim: '#ffffff',
      bloom: '#ffffff',
      beam: '#ffffff',
      spark: '#ffffff',
      hint: '#ffffff',
      cardBack: {
        top: '#ffffff',
        mid: '#f4f6ff',
        bottom: '#e9edf8',
        sheen: 'rgba(255,255,255,0.85)',
      },
      cornerRadius: 14,
    },
    motion: {
      speed: 1,
      introMs: 320,
      // Both belong to the cut and are unused here; kept at the shared
      // defaults so a host switching variants sees no surprise in `motion`
      finishMs: 170,
      autoSliceMs: 430,
      retractMs: 220,
      open: {
        ms: 1000,
        lid: 0.52,
        cardFrom: 0.34,
        sink: 0.5,
        gone: 0.8,
        clipFrom: 0.45,
        lidThrowX: 0.5,
        lidThrowY: 0.62,
        lidSpin: 0.5,
        lidFadeFrom: 0.15,
        lidFadeSpan: 0.45,
        uncutFade: 0.18,
      },
      // This mechanic assembles the card instead of turning it over, so only
      // `holdMs`, the three glow opacities and the card's geometry are read
      // from here — the spin, the wipe and the beam belong to the cut
      reveal: {
        /** The stand comes in behind the card, ahead of the host's own UI. */
        pedestalMs: 260,
        spinMs: 2200,
        unveilMs: 600,
        beamMs: 800,
        holdMs: 900,
        spinTurns: 2,
        beamTail: 0.32,
        sparks: 26,
        spinFlatness: 0.06,
        spinShade: 0.05,
        spinBloom: 0.85,
        bloomAlpha: 0.95,
        rimAlpha: 0.9,
        haloAlpha: 0.95,
        beamWidth: 3,
        beamAlpha: 0.9,
        beamGlowWidth: 11,
        beamGlowAlpha: 0.34,
        beamTipRadius: 8,
        beamSteps: 24,
        outlineDetail: 9,
        sparkSize: 1.3,
        sparkJitter: 2.4,
        sparkAlpha: 0.85,
        sparkSpreadX: 6,
        sparkSpreadY: 5,
        artWaitSpinMs: 600,
        // The card's own moment: its outline swells and a highlight runs
        // across the artwork. Both belong to the card, so a loud landing
        // still reads as the card arriving rather than as another blast
        pulseRim: 0.9,
        pulseHalo: 0.7,
        pulseSpread: 0.07,
        sheenMs: 850,
        sheenAlpha: 0.95,
        sheenWidth: 0.6,
        sheenTilt: 0.35,
      },
    },
    charge: {
      holdMs: 1100,
      releaseMs: 260,
      shake: 0.009,
      shakeHz: 22,
      squeeze: 0.05,
      heatAlpha: 0.7,
      haloAlpha: 0.85,
      bloomAlpha: 0.9,
      arcWidth: 4,
      arcAlpha: 0.95,
      sparks: 24,
      sparkReach: 0.85,
      sparkSize: 4,
      tickStep: 0.08,
      breathe: 0.012,
      breatheMs: 2600,
    },
    burst: {
      flashMs: 260,
      flashScale: 2.8,
      // Long enough to read as a held breath. The first pass at this was 180ms
      // and the card started gathering while the eye was still on the debris.
      beatMs: 420,
      // Straight to small pieces: 13 × 22 shards of the pack. Two stages — big
      // pieces breaking up mid-flight — read as the debris jumping and were
      // dropped.
      cols: 13,
      rows: 22,
      // The cut is a mosaic, so these three decide how uneven it looks and
      // never whether the pieces meet: nodes pushed a third of a cell off
      // true, three segments an edge, tears a tenth of a cell deep
      shapeJitter: 0.32,
      shapeSegments: 3,
      shapeRagged: 0.1,
      scatter: 0.45,
      lifeScatter: 0.5,
      shardMs: 1400,
      spread: 1.15,
      lift: 0.5,
      gravity: 2.6,
      spin: 3.4,
      fadeFrom: 0.5,
      glowFrom: 0.45,
      glowSwell: 1.4,
      spikes: 14,
      spikeMs: 520,
      spikeLength: 1.5,
      spikeWidth: 7,
      spikeAlpha: 0.9,
      // The front, not an outline: three waves a stagger apart, each a thick
      // soft band with a hot white edge riding it, flattened so it reads as
      // travelling across a floor rather than drawn on the glass
      rings: 3,
      ringMs: 760,
      ringStagger: 0.28,
      ringThickness: 0.16,
      ringRagged: 0.1,
      ringSquash: 0.22,
      ringAlpha: 0.55,
      ringCoreAlpha: 0.7,
      ringReach: 1.6,
      // The flare struck at the middle of the blast
      flareMs: 700,
      flareSpread: 1,
      flareReach: 1.6,
      flareAlpha: 0.8,
      flareSpin: 0.4,
      // The stage itself takes the hit: thrown off centre and shaken back,
      // in pack widths
      kickMs: 420,
      kickAmp: 0.035,
      kickHz: 13,
      // And goes white for a moment — the cheapest thing in the scene and the
      // one that carries the blast past the glass
      screenFlashMs: 220,
      screenFlashAlpha: 0.85,
      debris: 90,
      debrisMs: 1400,
      debrisSpread: 1.5,
      debrisSize: 2.6,
      debrisTrail: 1.4,
      debrisAlpha: 0.9,
      debrisGravity: 0.5,
      glitter: 70,
      glitterMs: 2600,
      glitterSize: 2.4,
      glitterAlpha: 0.75,
      glitterFall: 0.5,
      // Short on purpose: the cloud used to run its full length after the
      // shreds had gone, which left half a second of empty screen between the
      // blast and the card. It now starts while the foil is still burning out
      swarmMs: 520,
      dustMotes: 130,
      dustSize: 2.6,
      dustAlpha: 0.85,
      dustBloomAlpha: 0.75,
      assembleMs: 1400,
      assembleCols: 10,
      assembleRows: 14,
      assembleSpread: 1,
      assembleStagger: 0.35,
      assembleSpin: 2.6,
      assembleScaleFrom: 0.62,
      // Where the rarity tint starts draining out of a piece, as a share of
      // its approach, and where the finished card starts coming up underneath
      // the assembly, as a share of `assembleMs`
      tintFrom: 0.55,
      handoverFrom: 0.6,
      snapMs: 420,
      // Share of the snap over which the pieces dissolve off the card
      dissolveSpan: 0.55,
      snapOvershoot: 0.1,
      // Nothing is thrown at the card when it lands: the blast had its moment,
      // and a second one two seconds later fights the artwork instead of
      // presenting it
    },
    layout: {
      pack: {
        widthRatio: 0.86,
        heightRatio: 0.66,
        offsetY: 0.07,
      },
      card: {
        heightRatio: 0.95,
        packWidthRatio: 0.64,
        aspect: 0.66,
        maxRatio: 0.8,
      },
      pedestal: {
        widthRatio: 1.15,
        aspect: 0.335,
        gapRatio: 0.077,
        clearanceRatio: 0.1,
      },
      glow: {
        bloomScaleX: 3,
        bloomScaleY: 2.2,
        rimSpread: 40,
        rimPadding: 80,
        haloSpread: 56,
        haloPadding: 112,
      },
    },
    performance: {
      maxFps: 60,
      idleFps: 30,
      sleepFps: 1,
      resolutionCap: 2,
      antialias: true,
    },
  },
};
