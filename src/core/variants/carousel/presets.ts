import type {ResolvedOptions} from '../../config/types';
import {PRESETS as BURST_PRESETS} from '../burst/presets';

/**
 * `showcase` is the carousel as designed, timed off the reference it was
 * built from: copies of the pack on a turntable seen from just above, a
 * shuffle that spins them round, the finger turning it, a tap that drops
 * one and lifts it to centre stage where it floats until it is tapped again
 * — then the pack dissolves and the pull is talked about before it is
 * shown: a fact a second, the tier shouted across a banner, and only then
 * the flip into the card.
 *
 * The shared groups — the card, its glows, the stand, the stage — are the
 * burst's: this mechanic ends on the same card over the same stand, and a
 * host switching between them should see the same finish. Only the groups
 * the burst owns (`charge`, `burst`) are dropped for this one's own.
 */
const base = BURST_PRESETS.charged;

export const PRESETS: Record<
  'showcase',
  Omit<
    ResolvedOptions,
    'variant' | 'preset' | 'assets' | 'interaction' | 'hint' | 'charge' | 'burst'
  >
> = {
  showcase: {
    theme: {
      ...base.theme,
      // The turntable is a stage under lights: the pull's colour is the only
      // colour on it until the banner
      glow: '#f5d000',
    },
    motion: {
      ...base.motion,
      reveal: {
        ...base.motion.reveal,
        // The flip is its own phase; the spin/unveil/beam of the cut are unused
        holdMs: 900,
      },
    },
    layout: {
      ...base.layout,
      pack: {
        // The front copy is the measure: the turntable is laid out around it
        // on the whole stage — half the width of a phone, as the reference
        // has it — and sits a little above the middle
        widthRatio: 0.5,
        heightRatio: 0.45,
        offsetY: -0.04,
        anchor: 'stage',
      },
      card: {
        ...base.layout.card,
        // Read against the risen pack, which is bigger than the front copy
        packWidthRatio: 0.92,
      },
    },
    performance: base.performance,
    carousel: {
      copies: 5,
      // In front-copy widths: the copies stand this far from the axis, so
      // the two beside the front one sit a little apart from it
      // Tuned by eye against the reference in the console: a tight ring,
      // the neighbours gathered a little toward the front and turned just
      // short of tangent, the two behind seen from the back between them
      radius: 1.05,
      gather: 0.21,
      turn: 0.92,
      // A medium lens and the eye half a pack above the floor: the two
      // behind come out smaller and their feet climb the stage
      focal: 2.6,
      eye: 0.34,
      fade: 0.08,
      // The ring sits in the dark away from the front
      shade: 0.78,
      // The copies hover on the spot: slow and slight, each on its own beat
      hoverAmp: 0.012,
      hoverMs: 8700,
      // Still until touched: the shuffle and the finger turn it
      driftDps: 0,
      // Two whole turns and the settle: long enough to lose track, and the
      // copy it stops on is the one chosen
      shuffleTurns: 2,
      shuffleMs: 2600,
      // A drag across one pack width turns the ring about a fifth: the next copy
      dragTurn: 0.2,
      settleMs: 520,
      dropMs: 220,
      riseMs: 320,
      riseScale: 1.15,
      floatAmp: 0.012,
      floatMs: 2600,
      dissolveMs: 380,
      factMs: 320,
      factGapMs: 700,
      bannerMs: 900,
      bannerHoldMs: 1500,
      bannerTilt: -12,
      flipMs: 520,
      reflectionAlpha: 0.32,
      reflectionHeight: 0.7,
      // A sliver of floor between the pack and its reflection
      reflectionGap: 0.04,
    },
  },
};
