/**
 * A spinning pack as a pack is: flat at its sealed edges, swelling over the
 * card inside — a low, flat plateau with the foil sloping down to the seals.
 * The surface is laid out as a grid of points, each pushed towards the eye
 * by the swell there and seen in perspective as the pack turns; the slopes
 * take the light by how they face it — the side turned from it in shade, the
 * side turned to it lit, a glint where it catches the eye — so the volume
 * shows as the pack turns, and the flat parts look as a flat pack would.
 * Pure maths, in px about the item's centre; the eye is `focal` px in front.
 */

export const PILLOW = {
  /** How far the card inside lifts the foil, as a share of the pack's width. */
  height: 0.045,
  /** How wide the sealed, flat border is, as a share of the width and of the height (the crimped ends are deeper). */
  sealX: 0.1,
  sealY: 0.13,
};
/** Where the light comes from: above, a little to the left, in front. */
const LIGHT = normalize([-0.35, -0.6, -1]);
/** The eye, straight in front. */
const EYE = [0, 0, -1];
const HALF = normalize([LIGHT[0] + EYE[0], LIGHT[1] + EYE[1], LIGHT[2] + EYE[2]]);
/** How sharp the glint is, how much of it shows, and how far a slope turned from the light may fall into shade. */
const GLINT_POWER = 48;
const GLINT = 0.7;
const SHADE_FLOOR = 0.42;

function normalize([x, y, z]) {
  const n = Math.hypot(x, y, z) || 1;
  return [x / n, y / n, z / n];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/** How far up its slope `t` (0..1 across the pack) is, the seal `seal` wide: 0 on the seal's edge, 1 past it. */
function ramp(t, seal) {
  if (!(t > 0) || !(t < 1)) return 0;
  const x = Math.min(t, 1 - t) / seal;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}

/** How steeply `ramp` rises at `t`, per unit of `t`: nothing on the plateau, nothing on the very edge. */
function rampSlope(t, seal) {
  if (!(t > 0) || !(t < 1)) return 0;
  const x = Math.min(t, 1 - t) / seal;
  if (x >= 1) return 0;
  return ((6 * x * (1 - x)) / seal) * (t < 0.5 ? 1 : -1);
}

/** The swell at (`u`, `v`), shares of the pack's width and height: 0 on the seals and off the pack, 1 over the card. */
export function bulgeAt(u, v) {
  return ramp(u, PILLOW.sealX) * ramp(v, PILLOW.sealY);
}

/** A point of the surface, `depth` towards the eye (negative), turned by `yaw` and seen from `focal` in front. */
function project(x, y, depth, yaw, focal, out, at) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const x1 = x * cos - depth * sin;
  const z1 = x * sin + depth * cos;
  const k = focal / Math.max(focal * 0.2, focal + z1);
  out[at] = x1 * k;
  out[at + 1] = y * k;
}

/** The normal (`fx`, `fy` the surface's slope) turned by `yaw`. */
function turnedNormal(fx, fy, yaw) {
  const [nx, ny, nz] = normalize([fx, fy, -1]);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [nx * cos - nz * sin, ny, nx * sin + nz * cos];
}

/**
 * The grid of a pack `height` px high at its swell, turned by `yaw`: for each
 * of `cols` × `rows` points of its image (`image`, about the centre), row by
 * row, where it is drawn (`art`, x, y pairs) and the light it takes
 * (`light`): 1 as a flat pack's, less on a slope turned from the light, more
 * — up to 2 — on one turned to it or catching the eye. Points off the pack
 * itself (`body`, the box its artwork fills) and on its flat parts take 1.
 */
export function pillowGrid(image, body, yaw, focal, scale, height, cols, rows, into = null) {
  const n = cols * rows;
  const grid = into ?? {art: new Float32Array(n * 2), light: new Float32Array(n)};
  const bw = body.right - body.left;
  const bh = body.bottom - body.top;
  const lift = height * scale;
  const flat = turnedNormal(0, 0, yaw);
  const flatLight = Math.max(1e-3, dot(flat, LIGHT));
  const flatGlint = Math.pow(Math.max(0, dot(flat, HALF)), GLINT_POWER);
  for (let j = 0; j < rows; j++) {
    const fy = j / (rows - 1);
    for (let i = 0; i < cols; i++) {
      const fx = i / (cols - 1);
      const k = j * cols + i;
      const x = image.left + (image.right - image.left) * fx;
      const y = image.top + (image.bottom - image.top) * fy;
      // Where the point stands on the pack itself, across and down
      const u = bw > 0 ? (x - body.left) / bw : -1;
      const v = bh > 0 ? (y - body.top) / bh : -1;
      const across = ramp(u, PILLOW.sealX);
      const down = ramp(v, PILLOW.sealY);
      project(x * scale, y * scale, -lift * across * down, yaw, focal, grid.art, k * 2);
      if (!(height > 0) || bw <= 0 || bh <= 0) {
        grid.light[k] = 1;
        continue;
      }
      // The surface rises towards the eye (−z): its slope per px, across and down
      const slopeX = (-height * rampSlope(u, PILLOW.sealX) * down) / bw;
      const slopeY = (-height * across * rampSlope(v, PILLOW.sealY)) / bh;
      const normal = turnedNormal(slopeX, slopeY, yaw);
      const lit = Math.max(0, dot(normal, LIGHT)) / flatLight;
      const glint = Math.max(0, Math.pow(Math.max(0, dot(normal, HALF)), GLINT_POWER) - flatGlint);
      grid.light[k] = lit < 1 ? Math.max(SHADE_FLOOR, lit) : 1 + clamp01((lit - 1) * 1.4 + glint * GLINT);
    }
  }
  return grid;
}

/** The light on the whole of a pack turned `yaw` from the eye: all of it face on, `TURNED_DARK` of it edge on. */
const TURNED_DARK = 0.62;
export function facingLight(yaw) {
  return TURNED_DARK + (1 - TURNED_DARK) * Math.cos(yaw);
}
