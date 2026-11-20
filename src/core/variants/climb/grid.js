/**
 * Where the climb's items stand: a grid sized by how many there are and the
 * room they have, so a whole purchase fits on one stage without scrolling,
 * as large as it can be. Pure maths in css px.
 */

/** The room kept under an item `width` wide: `label` of its width, and never less than `labelMin` css px. */
export function labelRoomOf(width, label = 0, labelMin = 0) {
  return Math.max(width * label, labelMin);
}

/**
 * The widest an item may be in `cols` columns: `count` items `aspect` wide
 * for their height in `stage`, `gap` between neighbours — a share of the
 * item's width — and under each the room for its label (`labelRoomOf`), no
 * wider than `maxWidth`.
 */
function widthFor(count, cols, stage, aspect, gap, label, labelMin, maxWidth) {
  const rows = Math.ceil(count / cols);
  const byWidth = stage.width / (cols + gap * (cols - 1));
  // As tall as the stage lets the rows be, their labels a share of the width — or, smaller than that, the least
  const shared = stage.height / (rows / aspect + rows * label + gap * (rows - 1));
  const byHeight =
    shared * label >= labelMin ? shared : (stage.height - rows * labelMin) / (rows / aspect + gap * (rows - 1));
  return Math.max(0, Math.min(byWidth, byHeight, maxWidth));
}

/**
 * The columns that show `count` items largest: every number from one column
 * to all of them in a row is tried. Of two as large, fewer rows win, then
 * fewer columns — ten stand 5-5 on a wide stage and 4-4-2 on a phone.
 */
export function gridColumns(count, stage, aspect, gap = 0, label = 0, maxWidth = Infinity, labelMin = 0) {
  const n = Math.floor(count);
  if (!(n >= 1)) return 1;
  let best = {cols: 1, rows: n, width: -1};
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const width = widthFor(n, cols, stage, aspect, gap, label, labelMin, maxWidth);
    const larger = width > best.width + 0.5;
    const asLarge = Math.abs(width - best.width) <= 0.5;
    if (larger || (asLarge && rows < best.rows)) best = {cols, rows, width};
  }
  return best.cols;
}

/**
 * The items' boxes in grid order, left to right and top to bottom, in the
 * columns that show them largest (`gridColumns`): `gap` between neighbours —
 * a share of the item's width — and under each the room for its label
 * (`labelRoomOf`), no item wider than `maxWidth`. Every row is centred on its
 * own, so a short last row sits in the middle. Each box says where it
 * stands: its `row`, and its `col` counted from its row's start.
 */
export function gridRects(count, stage, aspect, {gap = 0, label = 0, labelMin = 0, maxWidth = Infinity} = {}) {
  const n = Math.floor(count);
  if (!(n >= 1)) return [];
  const cols = gridColumns(n, stage, aspect, gap, label, maxWidth, labelMin);
  const rows = Math.ceil(n / cols);
  const width = widthFor(n, cols, stage, aspect, gap, label, labelMin, maxWidth);
  const height = width / aspect;
  const space = width * gap;
  // One row: its items, the room for their labels and the gap to the next
  const pitch = height + labelRoomOf(width, label, labelMin) + space;
  const top = stage.top + (stage.height - rows * pitch + space) / 2;

  const rects = [];
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(cols, n - row * cols);
    const left = stage.left + (stage.width - inRow * width - space * (inRow - 1)) / 2;
    const y = top + row * pitch;
    for (let col = 0; col < inRow; col++) {
      const x = left + col * (width + space);
      rects.push({left: x, top: y, right: x + width, bottom: y + height, width, height, row, col});
    }
  }
  return rects;
}
