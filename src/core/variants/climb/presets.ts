import type {ResolvedOptions} from '../../config/types';
import {PRESETS as SLICE_PRESETS} from '../slice/presets';
import {FONT} from './font';

/**
 * `spectrum` is the climb as designed: six colours from white to gold, one
 * per tier, and the colour kept to the light round each item — the artwork
 * only takes a little of it, so the pack stays recognisable while it spins.
 *
 * The shared groups — the card, its glows, the stage — are the slice's: one
 * item alone is the size of the pack `slice` shows, and the cards are the
 * card every mechanic ends on. Only the groups the slice owns (`interaction`,
 * `hint`, `slice`) are dropped for this one's own.
 */
const base = SLICE_PRESETS.classic;

export const PRESETS: Record<
  'spectrum',
  Omit<
    ResolvedOptions,
    | 'variant'
    | 'preset'
    | 'assets'
    | 'sound'
    | 'interaction'
    | 'hint'
    | 'slice'
    | 'charge'
    | 'burst'
    | 'carousel'
  >
> = {
  spectrum: {
    theme: base.theme,
    motion: base.motion,
    layout: base.layout,
    performance: base.performance,
    climb: {
      count: 1,
      // Lowest tier first; the host gives the pack's top tier the last one
      cycleColors: ['#ffffff', '#97d926', '#0da7f2', '#8442f0', '#ff3b3b', '#ffc400'],
      tint: 0.25,
      flood: 0.85,
      flash: true,
      shake: 1,
      sparkle: true,
      reveal: 'shatter',
      dust: true,
      // Unnamed: in the band the host keeps over the grid
      gatherY: -1,
      price: {prefix: '$', suffix: '', decimals: 2},
      font: FONT,
      introMs: 500,
      spinMs: 900,
      // The reel spins 5–10 s at 1× (drawn each round); Speed up shortens it
      reelMinMs: 5000,
      reelMaxMs: 10000,
      // A quick cascade, over in half a second however many there are (`strobe.js`)
      stopStaggerMs: 120,
      flipStaggerMs: 220,
      hitHoldMs: 900,
      rollUpMs: 500,
    },
  },
};
