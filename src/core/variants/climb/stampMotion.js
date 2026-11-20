/** How the `SOLD` stamp comes down on a card (`soldStamp.js`). Pure numbers, ms. */

export const STAMP = {
  /** How large it starts, how long it takes to come down and to settle, in ms. */
  from: 1.9,
  fallMs: 120,
  settleMs: 110,
  /** How far it is pressed in as it lands. */
  pressed: 0.93,
};
const UNSTAMPED = {scale: STAMP.from, alpha: 0};
const STAMPED = {scale: 1, alpha: 1};

/** Where the stamp is `elapsed` ms after it starts to come down: its size against its own, and how much ink shows. */
export function stampAt(elapsed) {
  if (!(elapsed >= 0)) return UNSTAMPED;
  if (elapsed >= STAMP.fallMs + STAMP.settleMs) return STAMPED;
  if (elapsed < STAMP.fallMs) {
    const t = elapsed / STAMP.fallMs;
    // Gathering speed as it comes down
    return {scale: STAMP.from + (STAMP.pressed - STAMP.from) * t * t, alpha: Math.min(1, t * 2.2)};
  }
  const t = (elapsed - STAMP.fallMs) / STAMP.settleMs;
  return {scale: STAMP.pressed + (1 - STAMP.pressed) * (1 - (1 - t) * (1 - t)), alpha: 1};
}
