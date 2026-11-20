/**
 * The colours of the climb's reel: every item glows in colours of its own,
 * a fresh pick each time it stands edge-on (`strobe.js`), never the one it
 * has, and clear of the colours its neighbours glow in while the palette
 * allows. Nothing in a pick knows about the pull.
 */
import {nextCycleIndex} from '../shared/colorCycle';

/**
 * The next colour out of `count`: `nextCycleIndex`'s pick, so never the one
 * the item has, drawn again while it is one its neighbours glow in (as long
 * as one colour is left) or one of the other items', nearest first (as long
 * as two are). Neighbours glow apart, the grid holds as many colours as the
 * palette allows, and the pick is rarely forced.
 */
export function pickCycleIndex(previous, count, besides, nearby) {
  if (count < 2) return 0;
  const free = new Set();
  for (let i = 0; i < count; i++) {
    if (i !== previous) free.add(i);
  }
  for (const index of besides) {
    if (free.size <= 1) break;
    free.delete(index);
  }
  for (const index of nearby) {
    if (free.size <= 2) break;
    free.delete(index);
  }
  let pick = nextCycleIndex(previous, count);
  for (let tries = 0; !free.has(pick) && tries < 64; tries++) {
    pick = nextCycleIndex(previous, count);
  }
  return pick;
}

/**
 * For each box, the boxes beside it — in its row, or above or below it —
 * and the rest, nearest first. Counted in grid steps off each box's `row`
 * and `col`: a short row stands centred, half a step over for every box it
 * lacks, so the boxes over both its ends are beside it.
 */
export function neighboursOf(boxes) {
  const inRow = new Map();
  for (const {row} of boxes) inRow.set(row, (inRow.get(row) ?? 0) + 1);
  const cols = Math.max(0, ...inRow.values());
  const at = boxes.map(({row, col}) => ({x: col + (cols - inRow.get(row)) / 2, y: row}));
  const besides = [];
  const others = [];
  at.forEach((a, i) => {
    const near = [];
    const rest = [];
    at.forEach((b, j) => {
      if (j === i) return;
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      const beside = (dy === 0 && dx <= 1) || (dy === 1 && dx < 1);
      (beside ? near : rest).push({j, d: dx * dx + dy * dy});
    });
    rest.sort((p, q) => p.d - q.d);
    besides.push(near.map(({j}) => j));
    others.push(rest.map(({j}) => j));
  });
  return {besides, others};
}

/** The reel's hold on each item: the colour it is on and how long it keeps it. */
export class ReelColors {
  constructor() {
    this.holds = [];
    this.neighbours = {besides: [], others: []};
  }

  /** A hold for every box on the grid, and whose colours each keeps clear of. */
  layout(boxes) {
    this.holds.length = Math.min(this.holds.length, boxes.length);
    while (this.holds.length < boxes.length) this.holds.push({index: -1});
    this.neighbours = neighboursOf(boxes);
  }

  /**
   * Holds that follow their items to new places: `order[i]` is where item
   * `i` was, -1 for an item new to the grid.
   */
  follow(order) {
    const holds = this.holds;
    this.holds = order.map(i => (i >= 0 && holds[i] ? holds[i] : {index: -1}));
  }

  /** Nobody on a colour yet. */
  reset() {
    for (const hold of this.holds) {
      hold.index = -1;
    }
  }

  /**
   * A fresh colour out of `count` for item `i`, clear of the colours of the
   * items `cycling` still counts — one that has stopped on its own colour no
   * longer has a say.
   */
  next(i, count, cycling) {
    const hold = this.holds[i];
    const colours = list =>
      (list ?? []).filter(j => cycling(j) && this.holds[j].index >= 0).map(j => this.holds[j].index);
    hold.index = pickCycleIndex(
      hold.index,
      count,
      colours(this.neighbours.besides[i]),
      colours(this.neighbours.others[i]),
    );
    return hold.index;
  }
}
