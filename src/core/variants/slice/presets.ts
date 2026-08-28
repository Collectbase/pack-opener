import type {PresetName, ResolvedOptions} from '../../config/types';

/**
 * `classic` is the animation as it shipped in the app this was built for —
 * every number here was measured against the reference recording, so it is the
 * baseline other presets are judged against rather than an arbitrary default.
 *
 * Presets live with their variant: the numbers only mean anything to the scene
 * that reads them, so a new mechanic brings its own set rather than extending a
 * shared table.
 */
export const PRESETS: Record<PresetName, Omit<ResolvedOptions, 'variant' | 'preset' | 'assets'>> = {
  classic: {
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
      reveal: {
        spinMs: 3400,
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
      },
    },
    interaction: {
      activation: 12,
      completeFraction: 0.62,
      trailStep: 8,
      trailMaxPoints: 40,
      rampPoints: 6,
      gapRatio: 0.022,
      edgeJitter: 0.55,
      overshoot: 48,
      band: {top: 0.05, bottom: 0.62},
      finishOvershoot: 0.03,
      finishSlopeLimit: 0.8,
      tickStep: 0.07,
      autoArc: {inset: 0.06, fromY: 0.23, toY: 0.17, controlY: 0.1},
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
      lineRatio: 0.1,
      sweep: 0.78,
      headRadius: 8,
      tail: 0.34,
      segments: 80,
      tailAlpha: 0.75,
      tailFalloff: 1.6,
      loopMs: 1700,
      idleMs: 700,
      fadeMs: 200,
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
