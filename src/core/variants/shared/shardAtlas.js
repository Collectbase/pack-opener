/**
 * Cutting artwork into pieces that fit back together.
 *
 * A grid of rectangles makes debris look cheap — every piece the same shape,
 * and the eye reads the grid instead of the tear. But pieces cut as separate
 * outlines are worse: they cannot close over each other, so a card assembled
 * out of them is a card with gaps in it.
 *
 * So the cut is a mosaic. One grid of nodes is pushed off true, every edge
 * between two nodes is torn along the same points for both cells that share
 * it, and each cell is clipped to the outline those edges make. Neighbours
 * meet exactly: whole while whole, ragged once thrown.
 *
 * The whole thing is rasterised into one atlas — irregular pieces stay one
 * texture and one draw call instead of one mask each.
 */
import {Rectangle, Texture} from 'pixi.js';
import {jitterAt} from './geometry';

/** Ceiling on the atlas, so large artwork cannot blow up memory. */
const MAX_ATLAS = 2048;

/**
 * The source pixels behind a texture. Pixi keeps whatever the loader produced —
 * an ImageBitmap, an HTMLImageElement or a canvas — and `drawImage` takes all
 * three.
 */
function sourceImage(texture) {
  const source = texture?.source;
  return source?.resource ?? source?.source ?? null;
}

/**
 * One node of the grid, in source pixels. Nodes on the outer frame keep to it,
 * so the artwork's own edge stays straight — a card that has just been put
 * back together should not have a chewed border.
 */
function gridNode(c, r, g) {
  const insideX = c > 0 && c < g.cols;
  const insideY = r > 0 && r < g.rows;
  return {
    x: g.srcW * c + (insideX ? jitterAt(c * 31 + r * 7, 0.7) * g.srcW * g.jitter : 0),
    y: g.srcH * r + (insideY ? jitterAt(c * 17 + r * 3, 2.3) * g.srcH * g.jitter : 0),
  };
}

/**
 * The tear along one edge, as the points between its two nodes. Keyed by the
 * edge rather than by the cell, so the cell on either side of it gets the same
 * points and the two outlines coincide. Edges on the artwork's border are left
 * straight.
 */
function edgeTear(a, b, id, g, straight) {
  const points = [];
  if (straight) {
    return points;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;

  for (let k = 1; k < g.segments; k++) {
    const t = k / g.segments;
    const push = jitterAt(id * 13 + k, 1.9) * g.amp;
    points.push({x: a.x + dx * t + nx * push, y: a.y + dy * t + ny * push});
  }
  return points;
}

const horizontalId = (c, r, g) => (r * (g.cols + 1) + c) * 2;
const verticalId = (c, r, g) => (r * (g.cols + 1) + c) * 2 + 1;

/** The closed outline of one cell, walked clockwise from its top-left node. */
function cellOutline(c, r, g) {
  const a = gridNode(c, r, g);
  const b = gridNode(c + 1, r, g);
  const d = gridNode(c + 1, r + 1, g);
  const e = gridNode(c, r + 1, g);

  return [
    a,
    ...edgeTear(a, b, horizontalId(c, r, g), g, r === 0),
    b,
    ...edgeTear(b, d, verticalId(c + 1, r, g), g, c + 1 === g.cols),
    d,
    // Walked backwards, so the points match the cell below and to the left
    ...edgeTear(e, d, horizontalId(c, r + 1, g), g, r + 1 === g.rows).reverse(),
    e,
    ...edgeTear(a, e, verticalId(c, r, g), g, c === 0).reverse(),
  ];
}

/**
 * Re-cuts `texture` into one atlas of `cols` × `rows` interlocking pieces.
 *
 * Every piece is drawn into a cell of the atlas with `pad` of room around it —
 * nodes and tears reach past their own rectangle, and the caller needs the
 * same margin when it sizes the sprites, which is why `pad` comes back with
 * the frames.
 *
 * Returns `null` when the texture has no source pixels to cut.
 */
export function cutShardAtlas(texture, shape) {
  const image = sourceImage(texture);
  if (!image) {
    return null;
  }

  const {cols, rows} = shape;
  const frame = texture.frame;
  const srcW = frame.width / cols;
  const srcH = frame.height / rows;
  // Room for the furthest a node can wander plus the deepest tear, and a
  // little over so nothing is clipped by the cell it is drawn into
  const pad = shape.shapeJitter + shape.shapeRagged + 0.05;

  const g = {
    cols,
    rows,
    srcW,
    srcH,
    jitter: shape.shapeJitter,
    segments: Math.max(1, Math.round(shape.shapeSegments)),
    amp: Math.min(srcW, srcH) * shape.shapeRagged,
  };

  const cellW = srcW * (1 + pad * 2);
  const cellH = srcH * (1 + pad * 2);
  const scale = Math.min(
    1,
    MAX_ATLAS / (cellW * cols),
    MAX_ATLAS / (cellH * rows),
  );
  const outW = Math.max(1, Math.floor(cellW * scale));
  const outH = Math.max(1, Math.floor(cellH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW * cols;
  canvas.height = outH * rows;
  const ctx = canvas.getContext('2d');
  const frames = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = c * outW;
      const dy = r * outH;
      // Where this cell's slice of artwork starts, margin included
      const sx = srcW * c - srcW * pad;
      const sy = srcH * r - srcH * pad;
      const kx = outW / cellW;
      const ky = outH / cellH;

      ctx.save();
      ctx.beginPath();
      cellOutline(c, r, g).forEach((point, index) => {
        const x = dx + (point.x - sx) * kx;
        const y = dy + (point.y - sy) * ky;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(
        image,
        frame.x + sx,
        frame.y + sy,
        cellW,
        cellH,
        dx,
        dy,
        outW,
        outH,
      );
      ctx.restore();

      frames.push(new Rectangle(dx, dy, outW, outH));
    }
  }

  return {source: Texture.from(canvas).source, frames, pad};
}
