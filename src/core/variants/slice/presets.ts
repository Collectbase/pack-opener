import type {PresetName, ResolvedOptions} from '../../config/types';

/**
 * `classic` is the animation as it shipped in the Collectibles app — every
 * number here was measured against the reference recording, so it is the
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
      },
      reveal: {
        spinMs: 3400,
        unveilMs: 600,
        beamMs: 800,
        holdMs: 900,
        spinTurns: 2,
        beamTail: 0.32,
        sparks: 26,
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
    },
    layout: {
      card: {
        heightRatio: 0.95,
        packWidthRatio: 0.64,
        aspect: 0.66,
      },
    },
    hint: {
      lineRatio: 0.1,
      sweep: 0.78,
      headRadius: 8,
      tail: 0.34,
      segments: 80,
      loopMs: 1700,
      idleMs: 700,
      fadeMs: 200,
    },
  },
};

/** Card artwork the scene will wait for, before giving up and finishing. */
export const CARD_TIMEOUT_MS = 4000;
