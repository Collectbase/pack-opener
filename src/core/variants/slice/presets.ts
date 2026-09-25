import type {ResolvedOptions} from '../../config/types';

/**
 * `classic` is the animation this mechanic ships with: a large pack that
 * floats and catches the light, a cut that glows and throws sparks, a card
 * that rises out face down, gathers itself in its colour and turns over in
 * perspective. It is the baseline other presets are judged against rather
 * than an arbitrary default.
 *
 * Presets live with their variant: the numbers only mean anything to the scene
 * that reads them, so a new mechanic brings its own set rather than extending a
 * shared table.
 */
export const PRESETS: Record<
  'classic',
  Omit<ResolvedOptions, 'variant' | 'preset' | 'assets' | 'charge' | 'burst'>
> = {
  classic: {
    theme: {
      background: 'transparent',
      glow: '#9a6bff',
      rim: '#ffffff',
      bloom: '#ffffff',
      beam: '#ffffff',
      spark: '#ffffff',
      // Warm, like metal cut hot — the pull's own colour is kept for the card
      seam: '#ffcf8a',
      hint: '#ffffff',
      // Dark and engraved, so the card's colour has something to burn through
      cardBack: {
        top: '#262b3d',
        mid: '#141825',
        bottom: '#0a0c13',
        sheen: 'rgba(255,255,255,0.10)',
        line: 'rgba(170,186,255,0.09)',
        emblem: 'rgba(222,228,246,0.86)',
      },
      // The artwork's own corners: a graded slab is barely rounded, and cut
      // any rounder its frame loses its corners while the glow runs round a
      // shape the card does not have
      cornerRadius: 6,
    },
    motion: {
      speed: 1,
      introMs: 320,
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
        lidThrowX: 0.55,
        lidThrowY: 0.85,
        lidSpin: 0.9,
        // The lid is seen flying off, not fading where it was cut
        lidFadeFrom: 0.4,
        lidFadeSpan: 0.55,
        uncutFade: 0.18,
      },
      reveal: {
        /** The stand comes in behind the card, ahead of the host's own UI. */
        pedestalMs: 260,
        holdMs: 600,
        beamTail: 0.38,
        spinFlatness: 0.06,
        spinShade: 0.05,
        spinBloom: 0.85,
        bloomAlpha: 0.95,
        // Low, so the white edge never outshines the pull's own colour
        rimAlpha: 0.55,
        haloAlpha: 0.95,
        beamWidth: 3,
        beamAlpha: 0.9,
        beamGlowWidth: 14,
        beamGlowAlpha: 0.45,
        beamTipRadius: 8,
        beamSteps: 24,
        // One piece: the charge runs it round a card several hundred pixels tall
        beamStyle: 'ribbon',
        outlineDetail: 9,
        artWaitSpinMs: 600,
        // The card is shared, so it carries these even where the mechanic
        // never runs them
        pulseRim: 0.9,
        pulseHalo: 0.7,
        pulseSpread: 0.07,
        sheenMs: 620,
        sheenAlpha: 0.85,
        sheenWidth: 0.55,
        sheenTilt: 0.35,
      },
    },
    interaction: {
      activation: 12,
      completeFraction: 0.62,
      trailStep: 8,
      trailMaxPoints: 40,
      rampPoints: 6,
      // A fine, clean slit: the pack cut through, and the lid is what flies
      gapRatio: 0.012,
      edgeJitter: 0.2,
      overshoot: 48,
      band: {top: 0.05, bottom: 0.62},
      finishOvershoot: 0.03,
      finishSlopeLimit: 0.8,
      tickStep: 0.07,
      autoArc: {inset: 0.06, fromY: 0.23, toY: 0.17, controlY: 0.1},
    },
    layout: {
      // Nothing is kept back by default: a host that draws over the stage says
      // how much of it it needs
      stage: {
        reserveTop: 0,
        reserveBottom: 0,
      },
      // Measured by the pack itself rather than its image, and a good third
      // wider than the card it holds — the card is sized off it below
      pack: {
        widthRatio: 0.6,
        heightRatio: 0.58,
        offsetY: 0.02,
        anchor: 'stage',
      },
      card: {
        heightRatio: 0.95,
        packWidthRatio: 0.76,
        aspect: 0.66,
        // The artwork's own shape, landscape too: past this its sides are cut
        maxRatio: 2,
        spinAt: 'rest',
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
    hint: {
      // Just under the seal a foil pack is torn open at. The pack is measured
      // by the pack itself, so this is on the foil, not in the image's empty
      // margin above it
      lineRatio: 0.12,
      // Edge to edge: the cut it mimes runs the whole width of the pack
      sweep: 1,
      headRadius: 8,
      tail: 0.34,
      segments: 80,
      tailAlpha: 0.75,
      tailFalloff: 1.6,
      loopMs: 1700,
      idleMs: 700,
      fadeMs: 200,
    },
    slice: {
      floatAmp: 0.008,
      floatMs: 3600,
      foilEveryMs: 3400,
      foilMs: 1100,
      foilAlpha: 0.5,
      foilWidth: 0.5,
      foilTilt: 0.42,
      backlightAlpha: 0.22,
      backlightSpread: 28,
      bladeGlow: 16,
      bladeSparks: 0.4,
      sparkSpeed: 380,
      sparkLifeMs: 560,
      sparkSize: 2.6,
      sparkGravity: 1300,
      burstSparks: 90,
      joltScale: 0.035,
      pourAlpha: 0.75,
      riseBloom: 0.5,
      chargeMs: 1150,
      chargeWaitMs: 700,
      chargeLaps: 1.8,
      chargeHalo: 0.75,
      emblemAlpha: 0.95,
      tiltDeg: 8,
      tiltMs: 2300,
      tremble: 1.6,
      flipMs: 560,
      flipLift: 0.12,
      flipRise: 0.04,
      flipFlare: 0.75,
      focal: 3.2,
      landMs: 780,
      landPunch: 0.07,
      landShake: 5,
      twinkles: 7,
      twinkleSize: 52,
      twinkleMs: 360,
      embers: 26,
      emberMs: 2600,
      emberSize: 2.2,
      emberRise: 0.9,
      emberAlpha: 0.85,
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

/** Card artwork the scene will wait for, before giving up and finishing. */
export const CARD_TIMEOUT_MS = 4000;
