/**
 * How the items of a reel start to turn. Not together and not in a row: one
 * here, one there, each a moment after another, in an order drawn afresh for
 * every reel. And not smoothly: an item barely turns at first, then takes off
 * all at once — past its full speed, and settles back to it. Each keeps a
 * speed of its own from there, so within a second no two are in step.
 * Pure numbers, in ms.
 */

/** The longest the last item waits to start, and the wait between two starts when there are few. */
export const START_SPREAD_MS = 420;
export const START_GAP_MS = 110;
/** How far off its turn in the order an item may start, as a share of the wait between two starts. */
const START_PLAY = 0.3;
/** How long an item takes to get going, slowest and quickest. */
export const RAMP_MS = {min: 260, max: 380};
/**
 * How fast an item turns once it is going, in turns of `climb.spinMs`: the
 * reel runs faster than the turn the rest of the ceremony is paced by, and
 * every item at a speed of its own within this.
 */
export const RATE = {min: 1.5, max: 2.1};
/**
 * The share of its full speed an item starts at — it is seen to turn from its
 * first frame, slowly — and how sharply the speed grows from there: e^(K·t),
 * so half of the start is spent at about a third of the speed and the last
 * third of it brings most of the rest.
 */
const RAMP_FROM = 0.16;
const RAMP_K = 3.2;
/** How far past its full speed the start takes it, and how long it takes to settle back, in ms. */
const RAMP_OVER = 1.25;
const SETTLE_MS = 260;
/** The share of its start after which an item is seen to take off. */
export const KICK_AT = 0.72;

const span = (range, random) => range.min + (range.max - range.min) * random();

/** `0..n-1` in an order drawn with `random`. */
function shuffled(n, random) {
  const order = Array.from({length: n}, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * For each of `count` items, in grid order: how long it waits before it
 * starts to turn (`delayMs`), how long it takes to get going (`rampMs`) and
 * how fast it turns from there (`rate`). The starts are spread evenly over at
 * most `roomMs`, in an order drawn with `random` (0..1), each a little off
 * its moment; the speeds are spread over `RATE` the same way, in an order of
 * their own, so the slowest and the quickest are always well apart.
 */
export function reelStarts(count, random = Math.random, roomMs = Infinity) {
  const n = Math.max(0, Math.floor(count) || 0);
  const order = shuffled(n, random);
  const speeds = shuffled(n, random);
  const room = roomMs >= 0 ? roomMs : 0;
  const spread = n > 1 ? Math.min(START_SPREAD_MS, START_GAP_MS * (n - 1), room) : 0;
  const gap = n > 1 ? spread / (n - 1) : 0;
  const starts = new Array(n);
  order.forEach((item, turn) => {
    const at = (turn + (random() * 2 - 1) * START_PLAY) * gap;
    starts[item] = {
      delayMs: Math.min(spread, Math.max(0, at)),
      rampMs: span(RAMP_MS, random),
      rate: RATE.min + ((RATE.max - RATE.min) * (speeds[item] + random())) / n,
    };
  });
  return starts;
}

/**
 * The share of its full speed an item turns at, `elapsed` ms into a start
 * that takes `rampMs`: `RAMP_FROM` of it at first, growing faster and faster
 * to `RAMP_OVER` of it at the end of the start, then settling to 1.
 */
export function startSpeed(elapsed, rampMs) {
  if (!(elapsed >= 0)) return elapsed < 0 ? 0 : 1;
  const ramp = Math.max(1, rampMs);
  if (elapsed < ramp) {
    return RAMP_FROM + ((RAMP_OVER - RAMP_FROM) * Math.expm1((RAMP_K * elapsed) / ramp)) / Math.expm1(RAMP_K);
  }
  const settled = (elapsed - ramp) / SETTLE_MS;
  if (settled >= 1) return 1;
  return RAMP_OVER - (RAMP_OVER - 1) * (1 - Math.pow(1 - settled, 3));
}

/**
 * How long one ceremony's reel runs at the least, counted from its start:
 * drawn afresh each time between `minMs` and `maxMs`, so no two rounds spin
 * alike — `minMs` alone when there is no longer one.
 */
export function reelLengthMs(minMs, maxMs, random = Math.random) {
  const least = Math.max(0, Number(minMs) || 0);
  const most = Number(maxMs);
  if (!(most > least)) return least;
  return Math.round((least + (most - least) * random()) * 100) / 100;
}
