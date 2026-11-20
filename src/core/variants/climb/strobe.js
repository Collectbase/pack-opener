/**
 * The reel's rhythm: an item takes a fresh colour each time it stands
 * edge-on, every half turn, at once — the change happens where the eye
 * cannot see it, so the pack flashes from one colour to the next as it comes
 * round. And the stops: one after another, but the whole cascade over in
 * `STOP_SPREAD_MS` however many items there are. Pure numbers.
 */

/** The longest the stops may take from the first to the last, in ms of the ceremony's time. */
export const STOP_SPREAD_MS = 500;

const TWO_PI = Math.PI * 2;

/** Which side of its turn an item at `yaw` shows: 0 or 1, changing exactly as it stands edge-on (π/2, 3π/2). */
export function halfTurnOf(yaw) {
  const turned = ((yaw % TWO_PI) + TWO_PI) % TWO_PI;
  return Math.floor((turned + Math.PI / 2) / Math.PI) % 2;
}

/** The gap between one stop and the next for `count` items: `staggerMs`, closer when the cascade would run past `STOP_SPREAD_MS`. */
export function stopGapMs(count, staggerMs) {
  if (count < 2) return 0;
  return Math.min(Math.max(0, staggerMs), STOP_SPREAD_MS / (count - 1));
}
