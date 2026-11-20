/**
 * Packs bursting as their cards come up (`climb.reveal` `shatter`): the
 * back, in the foil and colour it spun in, cut into pieces (`shardMotion.js`)
 * that fly off over the grid while the card stands there in its place. The
 * pieces are drawn in the pack's own shader, so a piece is the part of the
 * pack it was. Spent pieces are kept for the next burst.
 */
import {Container} from 'pixi.js';
import {createFoilShard} from './pillowMesh';
import {SHATTER, shardAt, shardCells, shardThrow} from './shardMotion';

export class Shatter {
  constructor(parent) {
    this.layer = new Container();
    parent.addChild(this.layer);
    this.pieces = [];
    this.spare = [];
  }

  /**
   * The back of a pack bursting: `texture` drawn over `box` (the item's own
   * units, about its middle) at `x`, `y` and `scale` on the stage, flooded
   * with `color` as far as `flood`.
   */
  burst({texture, box, x, y, scale, color, flood}) {
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    if (!(width > 0) || !(height > 0) || !texture) return;
    for (const cell of shardCells(SHATTER.cols, SHATTER.rows)) {
      const mesh = this.spare.pop() ?? createFoilShard(texture);
      mesh.setPillowTexture(texture);
      mesh.setFlood(color, flood);
      mesh.writeUVs(cell.points);
      // The piece about its own middle, so it turns and tumbles about it
      const points = cell.points.map((v, k) => (k % 2 === 0 ? (v - cell.centre.x) * width : (v - cell.centre.y) * height));
      mesh.writePillow(points);
      mesh.alpha = 1;
      mesh.rotation = 0;
      mesh.scale.set(scale);
      const origin = {x: x + (box.left + cell.centre.x * width) * scale, y: y + (box.top + cell.centre.y * height) * scale};
      mesh.position.set(origin.x, origin.y);
      this.layer.addChild(mesh);
      this.pieces.push({mesh, origin, scale, reach: width * scale, thrown: shardThrow(cell.centre), elapsed: 0});
    }
  }

  /** Pieces still in the air: the stage is not at rest. */
  get live() {
    return this.pieces.length > 0;
  }

  update(deltaMS) {
    if (!this.pieces.length) return;
    let kept = 0;
    for (const piece of this.pieces) {
      piece.elapsed += deltaMS;
      if (piece.elapsed >= SHATTER.lifeMs) {
        this.spend(piece.mesh);
        continue;
      }
      const at = shardAt(piece.thrown, piece.elapsed);
      piece.mesh.position.set(piece.origin.x + at.x * piece.reach, piece.origin.y + at.y * piece.reach);
      piece.mesh.rotation = at.rotation;
      piece.mesh.scale.set(piece.scale * at.scale * at.flip, piece.scale * at.scale);
      piece.mesh.alpha = at.alpha;
      this.pieces[kept++] = piece;
    }
    this.pieces.length = kept;
  }

  spend(mesh) {
    this.layer.removeChild(mesh);
    this.spare.push(mesh);
  }

  clear() {
    for (const piece of this.pieces) this.spend(piece.mesh);
    this.pieces.length = 0;
  }

  destroy() {
    this.clear();
    for (const mesh of this.spare) mesh.destroy();
    this.spare.length = 0;
    this.layer.destroy({children: true});
  }
}
