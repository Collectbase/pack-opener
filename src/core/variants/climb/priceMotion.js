/**
 * How a card's price moves. It is there at once as the card lands — whole,
 * not grown in: a touch too large and a touch too low for a moment, and then
 * it stands still — and it counts up to its figure in the time it takes to
 * notice it. A moment after, stars twinkle at its sides. Once every card is
 * up, all the prices leave their cards and fly into one place, where the host
 * writes the total: slow to leave, fast to arrive, the nearest first.
 *
 * All of it by the wall clock: a ceremony that is hurried brings the cards
 * sooner, but each price takes the time it takes — hurried too it would be
 * gone before it was read. Pure numbers, ms.
 */

/** How long a price takes to settle into its place and size, and how long of that to show whole. */
export const APPEAR_MS = 110;
const APPEAR_FADE_MS = 50;
/** How much too large it is at first, and how far under its place, in its own heights. */
const APPEAR_OVER = 0.05;
const APPEAR_DROP = 0.14;
/** How long the count up to its figure takes. */
export const COUNT_MS = 140;

const AT_REST = {alpha: 1, scale: 1, drop: 0};

/** A price `elapsed` ms after it appeared: how much of it shows, its size against its own, and how far under its place it is, in its own heights. */
export function appearAt(elapsed) {
  if (Number.isNaN(elapsed) || elapsed >= APPEAR_MS) return AT_REST;
  const t = Math.max(0, elapsed) / APPEAR_MS;
  const settled = 1 - (1 - t) * (1 - t) * (1 - t);
  return {
    alpha: Math.min(1, Math.max(0, elapsed) / APPEAR_FADE_MS),
    scale: 1 + APPEAR_OVER * (1 - settled),
    drop: APPEAR_DROP * (1 - settled),
  };
}

/** The share of its figure a price shows `elapsed` ms into its count: most of it at once, the rest slowing in. */
export function countAt(elapsed) {
  if (Number.isNaN(elapsed) || elapsed >= COUNT_MS) return 1;
  const t = Math.max(0, elapsed) / COUNT_MS;
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

/**
 * The stars at a price's sides: how long after its count they begin, how
 * long one twinkles, how long each waits for the one before, and how many a
 * side.
 */
export const SPARK = {delayMs: 110, lifeMs: 340, gapMs: 55, perSide: 3};

const DARK = {scale: 0, alpha: 0};

/** A star `elapsed` ms into its twinkle: its size against its full one and how bright — nothing, all, nothing. */
export function sparkAt(elapsed) {
  if (!(elapsed > 0) || elapsed >= SPARK.lifeMs) return DARK;
  const swell = Math.sin((Math.PI * elapsed) / SPARK.lifeMs);
  return {scale: swell, alpha: Math.min(1, swell * 1.4)};
}

/**
 * The gathering: how long the prices stand, all counted, before they leave;
 * how long one takes to fly; and the most the farthest leaves after the
 * nearest.
 */
export const GATHER = {holdMs: 420, flightMs: 340, spreadMs: 110};
/** How sharply a price gathers speed, how small it lands, and the share of its flight after which it fades. */
const FLIGHT_POWER = 2.4;
const FLIGHT_TO = 0.5;
const FLIGHT_FADE_FROM = 0.72;

/** A price `t` (0..1) of its flight: how far along it is, its size and how much of it shows. */
export function flightAt(t) {
  const u = Number.isNaN(t) ? 1 : Math.min(1, Math.max(0, t));
  return {
    along: Math.pow(u, FLIGHT_POWER),
    scale: 1 + (FLIGHT_TO - 1) * u * u,
    alpha: u <= FLIGHT_FADE_FROM ? 1 : 1 - (u - FLIGHT_FADE_FROM) / (1 - FLIGHT_FADE_FROM),
  };
}

/** How long each of the prices at `places` waits before it leaves for `to`: the nearest none, the farthest `spreadMs`. */
export function gatherDelays(places, to) {
  const far = places.map(p => Math.hypot(p.x - to.x, p.y - to.y));
  const least = Math.min(...far);
  const most = Math.max(...far);
  const span = most - least;
  return far.map(d => (span > 1e-6 ? ((d - least) / span) * GATHER.spreadMs : 0));
}
