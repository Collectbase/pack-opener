/**
 * Maths every mechanic needs: easing, the stable noise ragged edges are built
 * from, where the pack sits on the stage and how a beam walks the card's
 * outline. Nothing here touches Pixi or the DOM, and nothing here knows which
 * variant is asking.
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

/**
 * A point of a flat card turned about its upright axis by `yaw` and tipped
 * about its crosswise one by `pitch`, seen through a lens `focal` px from it.
 * The card's centre is the origin both ways: `x`, `y` are the point on the
 * card, what comes back is where it lands on the stage around that centre.
 * Scaling alone reads as a card getting thinner; the edge turning away
 * getting shorter is what reads as a turn.
 */
export function projectPoint(x, y, yaw, pitch, focal) {
  const x1 = x * Math.cos(yaw);
  const z1 = x * Math.sin(yaw);
  const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
  const k = focal / Math.max(focal * 0.2, focal + z2);
  return {x: x1 * k, y: y2 * k};
}

/* ─── geometry ─────────────────────────────────────────────────────────── */

/**
 * Where the pack sits on the stage. The ratios cap it against the screen and
 * the artwork's own aspect decides the rest, so the same numbers hold on a
 * phone and on a tablet. A variant that needs more — bands a gesture reads,
 * for instance — derives them from this box rather than redoing it.
 *
 * `stage` is what the host keeps for itself (`layout.stage`): the pack is
 * sized against the band left free, and centred on the stage as long as that
 * keeps it out of the bands — lower, in the middle of the free band, when the
 * band at the top would cover it. Its size is not held to the card's rule of
 * staying off the lower half (see `RevealCard.restingY`): that rule is for
 * what the host hangs under the card once it is out, and nothing hangs under
 * a sealed pack. Held to it, a title band at the top shrank the pack by twice
 * its own height. `anchorY`, when given, is where the pack's centre goes
 * instead — a scene anchoring the pack to the card's resting place passes it,
 * sized on a first pass without it.
 */
export function computePackRect(width, height, aspect, pack, stage, anchorY) {
  const reservedTop = stage?.reserveTop ?? 0;
  const reservedBottom = stage?.reserveBottom ?? 0;
  const free = Math.max(1, height - reservedTop - reservedBottom);

  const maxWidth = width * pack.widthRatio;
  const maxHeight = free * pack.heightRatio;
  let w = maxWidth;
  let h = w / aspect;
  if (h > maxHeight) {
    h = maxHeight;
    w = h * aspect;
  }
  const left = (width - w) / 2;
  const centredInFree = reservedTop + (free - h) / 2 + free * pack.offsetY;
  const centredOnStage = (height - h) / 2 + height * pack.offsetY;
  const centred = clamp(
    Math.min(centredInFree, centredOnStage),
    reservedTop,
    reservedTop + free - h,
  );
  const top = anchorY === undefined ? centred : anchorY - h / 2;

  return {
    left,
    top,
    right: left + w,
    bottom: top + h,
    width: w,
    height: h,
  };
}
