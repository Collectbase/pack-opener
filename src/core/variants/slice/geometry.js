/**
 * What the slice mechanic adds to the shared maths: the bands the cut may
 * travel through and how wide it opens. Re-exported alongside them so the rest
 * of the variant has one place to import from.
 */
export * from '../shared/geometry';

import {computePackRect} from '../shared/geometry';

const WHOLE = {left: 0, top: 0, right: 1, bottom: 1};

/**
 * The pack box plus the three numbers only a cut cares about: the top and
 * bottom of the band the blade is clamped to, and the half-width of the fully
 * opened gap.
 *
 * The box is the pack itself, not its image: `bounds` says where the pack is
 * inside the artwork (fractions of it, see `contentBoundsOf`), and a pack
 * image carries transparent margins — laid out by the image's edges, the pack
 * came out a fifth smaller than asked and the card it held looked bigger than
 * it. `image` is where the artwork has to be drawn for the pack to land in
 * the box.
 */
export function computeSliceRect(
  width,
  height,
  aspect,
  interaction,
  pack,
  stage,
  anchorY,
  bounds = WHOLE,
) {
  const share = {
    x: Math.max(0.05, bounds.right - bounds.left),
    y: Math.max(0.05, bounds.bottom - bounds.top),
  };
  const rect = computePackRect(
    width,
    height,
    (aspect * share.x) / share.y,
    pack,
    stage,
    anchorY,
  );
  const imageWidth = rect.width / share.x;
  const imageHeight = rect.height / share.y;

  return {
    ...rect,
    image: {
      left: rect.left - bounds.left * imageWidth,
      top: rect.top - bounds.top * imageHeight,
      width: imageWidth,
      height: imageHeight,
    },
    cutTop: rect.top + rect.height * interaction.band.top,
    cutBottom: rect.top + rect.height * interaction.band.bottom,
    gap: rect.height * interaction.gapRatio,
  };
}
