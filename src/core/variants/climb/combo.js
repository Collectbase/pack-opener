/**
 * Which cards a combo counts out. The host's words name a tier — the best
 * one that came up on two or more cards (`DOUBLE GRAIL`) — and a host that
 * knows it marks those cards (`combo` on a card). Unmarked, the scene works
 * it out the same way from the colours: the hits of the colour standing
 * highest in the palette among those that came up twice or more; with no
 * such pair, every hit. Pure.
 */

/**
 * The indices of `cards` the combo counts, in grid order, `max` at most.
 * `rankOf(color)` is where a colour stands in the palette, lowest first.
 */
export function comboIndices(cards, rankOf, max) {
  const named = [];
  const hits = [];
  const byColor = new Map();
  cards.forEach((card, i) => {
    if (card?.combo) named.push(i);
    if (!card?.hit) return;
    hits.push(i);
    const group = byColor.get(card.color);
    if (group) group.push(i);
    else byColor.set(card.color, [i]);
  });
  if (named.length) return named.slice(0, max);
  let best = null;
  let bestRank = -Infinity;
  for (const [color, group] of byColor) {
    if (group.length < 2) continue;
    const rank = rankOf(color);
    if (best === null || rank > bestRank) {
      best = group;
      bestRank = rank;
    }
  }
  return (best ?? hits).slice(0, max);
}
