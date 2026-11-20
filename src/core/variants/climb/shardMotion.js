/**
 * How a pack bursts as its card comes up (`climb.reveal` `shatter`): its back
 * is cut into a grid of uneven pieces — the grid's inner points thrown off
 * true, its outline left straight — and each piece flies off away from the
 * middle, at the eye first, then turning over, falling and fading. Pure
 * numbers; distances in widths of the card, so one throw suits any size.
 */

export const SHATTER = {
  /** The pieces across and down. */
  cols: 3,
  rows: 4,
  /** How far an inner point of the cut wanders, as a share of a piece. */
  jitter: 0.3,
  /** How long a piece flies, in ms. */
  lifeMs: 640,
  /** How fast it leaves, in card widths a second, and how much it lifts as it goes. */
  speed: 2.1,
  lift: 0.5,
  /** How fast it falls back, in card widths a second per second. */
  gravity: 4.2,
  /** How fast it turns flat and tumbles over, in turns a second at most. */
  spin: 1.6,
  tumble: 2.4,
};

/** The share of its flight a piece spends coming at the eye, and how much larger it gets. */
const TOWARDS = 0.12;
const NEAREST = 1.18;
/** How small it is at the end, and when it starts to fade. */
const FARTHEST = 0.55;
const FADE_FROM = 0.45;

/**
 * The back cut into `cols` × `rows` pieces over the unit square, row by row:
 * each piece's four corners (x, y pairs, clockwise on the screen) and its
 * middle. Neighbours share their corners, so the pieces fit together whole.
 */
export function shardCells(cols, rows, random = Math.random) {
  const wander = () => (random() * 2 - 1) * SHATTER.jitter;
  const grid = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const edgeX = i === 0 || i === cols;
      const edgeY = j === 0 || j === rows;
      // The outline stays straight: an edge point slides only along its edge
      const x = (i + (edgeX ? 0 : wander())) / cols;
      const y = (j + (edgeY ? 0 : wander())) / rows;
      grid.push([x, y]);
    }
  }
  const at = (i, j) => grid[j * (cols + 1) + i];
  const cells = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const corners = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const points = corners.flat();
      const centre = {
        x: corners.reduce((sum, p) => sum + p[0], 0) / 4,
        y: corners.reduce((sum, p) => sum + p[1], 0) / 4,
      };
      cells.push({points, centre});
    }
  }
  return cells;
}

/** The throw of a piece whose middle is at `centre` of the unit square: its speed, spin and tumble. */
export function shardThrow(centre, random = Math.random) {
  let dx = centre.x - 0.5;
  let dy = centre.y - 0.5;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) {
    const angle = random() * Math.PI * 2;
    dx = Math.cos(angle);
    dy = Math.sin(angle);
  } else {
    dx /= length;
    dy /= length;
  }
  const speed = SHATTER.speed * (0.7 + 0.6 * random());
  return {
    vx: dx * speed,
    vy: dy * speed - SHATTER.lift,
    spin: (random() * 2 - 1) * SHATTER.spin * Math.PI * 2,
    tumble: (0.5 + 0.5 * random()) * SHATTER.tumble * Math.PI * 2,
  };
}

/**
 * Where a piece thrown `throw` is `elapsed` ms on: how far it has flown (x,
 * y, in card widths), turned (`rotation`), its size against its own
 * (`scale`), how flat it is turned (`flip`, 1 face on) and how much of it
 * shows (`alpha`).
 */
export function shardAt(thrown, elapsed) {
  const t = Math.min(1, Math.max(0, elapsed / SHATTER.lifeMs));
  const s = (t * SHATTER.lifeMs) / 1000;
  // Slowed by the air as it goes
  const drag = 1 - 0.35 * t;
  const scale =
    t < TOWARDS ? 1 + (NEAREST - 1) * (t / TOWARDS) : NEAREST - (NEAREST - FARTHEST) * ((t - TOWARDS) / (1 - TOWARDS));
  const alpha = t >= 1 ? 0 : t < FADE_FROM ? 1 : 1 - (t - FADE_FROM) / (1 - FADE_FROM);
  return {
    x: thrown.vx * s * drag,
    y: thrown.vy * s * drag + 0.5 * SHATTER.gravity * s * s,
    rotation: thrown.spin * s,
    scale,
    flip: Math.cos(thrown.tumble * s),
    alpha,
  };
}
