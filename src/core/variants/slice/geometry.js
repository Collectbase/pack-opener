/**
 * What the slice mechanic adds to the shared maths: the bands the cut may
 * travel through and how wide it opens. Re-exported alongside them so the rest
 * of the variant has one place to import from.
 */
export * from '../shared/geometry';

import {computePackRect} from '../shared/geometry';

/**
 * The pack box plus the three numbers only a cut cares about: the top and
 * bottom of the band the blade is clamped to, and the half-width of the fully
 * opened gap.
 */
export function computeSliceRect(width, height, aspect, interaction, pack) {
  const rect = computePackRect(width, height, aspect, pack);

  return {
    ...rect,
    cutTop: rect.top + rect.height * interaction.band.top,
    cutBottom: rect.top + rect.height * interaction.band.bottom,
    gap: rect.height * interaction.gapRatio,
  };
}
