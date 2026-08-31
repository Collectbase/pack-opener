/**
 * Numbers the slice variant runs on: easing, the stable noise its ragged edges
 * use, where the pack sits on the stage and how the beam walks the card's
 * outline. Nothing here touches Pixi or the DOM.
 */

export const clamp = (value, min, max) =>
  value < min ? min : value > max ? max : value;

/** Stable pseudo-noise keyed by point index — the ragged edge never flickers. */
export const jitterAt = (index, phase) =>
  Math.sin(index * 1.73 + phase) * 0.6 +
  Math.sin(index * 4.31 + phase * 2.1) * 0.4;

export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeInOut = t =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Sampled outline of the card, used by the beam that runs around it. */
export function outlinePath(w, h, radius, perCorner = 8) {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  const points = [];
  const corners = [
    {cx: w - r, cy: r, start: -Math.PI / 2},
    {cx: w - r, cy: h - r, start: 0},
    {cx: r, cy: h - r, start: Math.PI / 2},
    {cx: r, cy: r, start: Math.PI},
  ];
  const straights = [
    [{x: r, y: 0}, {x: w - r, y: 0}],
    [{x: w, y: r}, {x: w, y: h - r}],
    [{x: w - r, y: h}, {x: r, y: h}],
    [{x: 0, y: h - r}, {x: 0, y: r}],
  ];

  for (let side = 0; side < 4; side++) {
    points.push(straights[side][0], straights[side][1]);
    const {cx, cy, start} = corners[side];
    for (let i = 1; i < perCorner; i++) {
      const angle = start + (Math.PI / 2) * (i / perCorner);
      points.push({x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle)});
    }
  }

  const lengths = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
    lengths.push(total);
  }
  const closing = Math.hypot(
    points[0].x - points[points.length - 1].x,
    points[0].y - points[points.length - 1].y,
  );

  return {points, lengths, total: total + closing};
}

export function pointAt(path, distance) {
  const {points, lengths, total} = path;
  let d = distance % total;
  if (d < 0) {
    d += total;
  }
  const lastLength = lengths[lengths.length - 1];
  if (d >= lastLength) {
    const last = points[points.length - 1];
    const first = points[0];
    const t = (d - lastLength) / (total - lastLength || 1);
    return {x: last.x + (first.x - last.x) * t, y: last.y + (first.y - last.y) * t};
  }

  let lo = 0;
  let hi = lengths.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] <= d) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const t = (d - lengths[lo]) / (lengths[hi] - lengths[lo] || 1);
  return {
    x: points[lo].x + (points[hi].x - points[lo].x) * t,
    y: points[lo].y + (points[hi].y - points[lo].y) * t,
  };
}

/* ─── geometry ─────────────────────────────────────────────────────────── */

/** Where the pack sits on the stage, and the bands the gesture reads. */
export function computePackRect(width, height, aspect, interaction, pack) {
  const maxWidth = width * pack.widthRatio;
  const maxHeight = height * pack.heightRatio;
  let w = maxWidth;
  let h = w / aspect;
  if (h > maxHeight) {
    h = maxHeight;
    w = h * aspect;
  }
  const left = (width - w) / 2;
  const top = (height - h) / 2 + height * pack.offsetY;

  return {
    left,
    top,
    right: left + w,
    bottom: top + h,
    width: w,
    height: h,
    cutTop: top + h * interaction.band.top,
    cutBottom: top + h * interaction.band.bottom,
    gap: h * interaction.gapRatio,
  };
}
