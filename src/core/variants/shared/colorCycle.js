/** How long the wide light takes to follow the beam to a new colour (`chargeCycle`). */
export const CYCLE_FADE_MS = 100;

/**
 * A pick out of `count`, never `previous` again when there is a choice. Not
 * the seeded generator the sparks use: a sequence that repeated every opening
 * would soon read as part of the animation rather than a gamble.
 */
export function nextCycleIndex(previous, count) {
  if (count < 2) {
    return 0;
  }
  if (previous < 0 || previous >= count) {
    return Math.floor(Math.random() * count);
  }
  const pick = Math.floor(Math.random() * (count - 1));
  return pick >= previous ? pick + 1 : pick;
}
