/**
 * The turntable: copies of the pack standing on a ring, each tangent to it
 * and facing out, seen from in front and a little above, each mirrored in
 * the floor. It owns the copies and their placement — the scene only says
 * how far the ring has turned, which copy is chosen, and how far the chosen
 * one has fallen or its neighbours faded.
 *
 * The ring is real: copies have a place in depth and are projected onto the
 * stage through a lens, so the two beside the front one turn away as a
 * pack on a shelf does — their near edge tall, their far edge short — and
 * the two round the back are seen from behind, smaller and darker, the
 * artwork mirrored the way the reference shows it. Each copy is a
 * `PerspectiveMesh`: four corners on the stage, the artwork mapped between
 * them in true perspective.
 *
 * The front copy is the measure: whatever the ring does, a copy squarely at
 * the front is exactly the rect the layout gave, standing on `floorY`.
 */
import {Container, PerspectiveMesh, Sprite, Texture} from 'pixi.js';
import {clamp} from '../shared/geometry';

const TWO_PI = Math.PI * 2;
/** Grid of the perspective mesh: enough for the texture not to bend between vertices. */
const MESH_GRID = 8;

/** Angle normalised to (-π, π]. */
export function wrap(angle) {
  let a = angle % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  if (a <= -Math.PI) a += TWO_PI;
  return a;
}

/**
 * The floor's fade for the reflections: white at the floor line, gone a
 * way below it. A mask, so every reflection fades the same way.
 */
function makeFadeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  // Whole down to the floor line (the top two fifths), then gone
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 256);
  return Texture.from(canvas);
}

/** The whole image: what the pixels say when they cannot be read. */
const WHOLE = {left: 0, top: 0, right: 1, bottom: 1};

/**
 * Where the pack itself is in its artwork, as fractions of the image: a
 * pack image carries transparent margins, and laid out by its edges the
 * pack comes out smaller than asked, while a reflection that starts at the
 * image's edge floats a margin's width below the pack, twice over. Read
 * once off the pixels, coarsely; the whole image when they cannot be read
 * (a tainted canvas).
 */
export function contentBoundsOf(texture) {
  try {
    const source = texture?.source?.resource;
    if (!source || !source.width) return WHOLE;
    const w = 128;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(source, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let left = w;
    let right = -1;
    let top = h;
    let bottom = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] <= 24) continue;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    if (right < 0) return WHOLE;
    return {left: left / w, top: top / h, right: (right + 1) / w, bottom: (bottom + 1) / h};
  } catch {
    return WHOLE;
  }
}

/** Whether `p` is inside the convex quad `q` (four corners in order). */
function inQuad(p, q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

export class Turntable {
  constructor(root, texture, options) {
    this.root = root;
    this.texture = texture;
    this.o = options;
    this.node = new Container();
    // Reflections under the copies, fading down the floor
    this.mirrors = new Container();
    this.fade = new Sprite(makeFadeTexture());
    this.mirrors.mask = this.fade;
    this.node.addChild(this.mirrors, this.fade);
    this.faces = new Container();
    this.node.addChild(this.faces);
    root.addChild(this.node);
    this.copies = [];
    this.angle = 0;
    this.chosen = -1;
    // The hover's clock: the copies rise and sink on it
    this.hoverClock = 0;
    this.contentBottom = contentBoundsOf(texture).bottom;
    this.build();
  }

  /** Time passing: the copies hover, so they are laid out again. */
  tick(deltaMS) {
    if (this.o.carousel.hoverAmp <= 0) return;
    this.hoverClock += deltaMS;
    this.place();
  }

  setOptions(options) {
    this.o = options;
    if (this.copies.length !== Math.max(1, Math.round(this.o.carousel.copies))) {
      this.build();
    }
  }

  build() {
    for (const copy of this.copies) {
      copy.mesh.destroy();
      copy.mirror.destroy();
    }
    this.copies = [];
    this.faces.removeChildren();
    this.mirrors.removeChildren();
    const count = Math.max(1, Math.round(this.o.carousel.copies));
    for (let i = 0; i < count; i++) {
      const mesh = new PerspectiveMesh({
        texture: this.texture,
        verticesX: MESH_GRID,
        verticesY: MESH_GRID,
      });
      const mirror = new PerspectiveMesh({
        texture: this.texture,
        verticesX: MESH_GRID,
        verticesY: MESH_GRID,
      });
      this.faces.addChild(mesh);
      this.mirrors.addChild(mirror);
      this.copies.push({mesh, mirror, index: i, fade: 1, drop: 0, quad: null, depth: 0, facing: 0});
    }
    this.place();
  }

  /**
   * The front copy's box on the stage: everything else is placed against it.
   * `floorY` is where the copies stand — the front copy's bottom edge.
   */
  layout(rect) {
    this.rect = rect;
    this.floorY = rect.bottom;
    this.centreX = rect.left + rect.width / 2;
    this.place();
  }

  /** The ring's own angle for copy `index`, in (-π, π]: 0 is squarely at the front. */
  angleOf(index) {
    const count = this.copies.length;
    return wrap(this.angle + (index / count) * TWO_PI);
  }

  /** The ring angle that brings copy `index` squarely to the front. */
  angleFor(index) {
    const count = this.copies.length;
    return wrap(-(index / count) * TWO_PI);
  }

  /** The ring angle nearest `angle` that has some copy squarely at the front. */
  nearestRest(angle) {
    const step = TWO_PI / this.copies.length;
    return Math.round(angle / step) * step;
  }

  /** Which copy is nearest the front right now. */
  get nearest() {
    let best = 0;
    let bestCos = -2;
    for (let i = 0; i < this.copies.length; i++) {
      const cos = Math.cos(this.angleOf(i));
      if (cos > bestCos) {
        bestCos = cos;
        best = i;
      }
    }
    return best;
  }

  /**
   * Where round the ring copy `index` stands, once the copies have gathered
   * toward the front: an even ring's angle bent by `gather`, smoothly and
   * periodically, so a turn is still a turn.
   */
  bentAngleOf(index) {
    const a = this.angleOf(index);
    return a - this.o.carousel.gather * Math.sin(a);
  }

  /** Copy `index`'s box on the stage, for the scene to lift it from. */
  boundsOf(index) {
    const copy = this.copies[index];
    if (!copy || !copy.quad) return null;
    const xs = copy.quad.map(p => p.x);
    const ys = copy.quad.map(p => p.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    return {left, right, top, bottom, width: right - left, height: bottom - top};
  }

  /** The copy under a point, or -1. Nearer copies win where they overlap. */
  hit(x, y) {
    let found = -1;
    let foundDepth = Infinity;
    for (const copy of this.copies) {
      if (copy.fade <= 0 || copy.facing <= 0 || !copy.quad) continue;
      if (inQuad({x, y}, copy.quad) && copy.depth < foundDepth) {
        found = copy.index;
        foundDepth = copy.depth;
      }
    }
    return found;
  }

  /** Lays every copy out for the current angle, fades and drops. */
  place() {
    if (!this.rect) return;
    const {rect} = this;
    const c = this.o.carousel;
    const w = rect.width;
    const h = rect.height;
    // The lens: the eye `focal` pack widths in front of the front copy, `eye`
    // pack heights above the floor. Lengths on the front copy's plane are
    // stage px as they are, so the front copy is its rect exactly
    const F = w * c.focal;
    const R = w * c.radius;
    const eyeY = h * c.eye;
    const horizonY = this.floorY - eyeY;
    const D = F + R;
    const project = (x, y, z) => ({
      x: this.centreX + (F * x) / z,
      y: horizonY - (F * (y - eyeY)) / z,
    });

    const order = [];
    for (const copy of this.copies) {
      const a = this.bentAngleOf(copy.index);
      // The copy's centre on the ring, and the line it stands along: the
      // ring's tangent there, so it faces out — or short of it by `turn`,
      // kept a little toward the viewer
      const cx = R * Math.sin(a);
      const cz = D - R * Math.cos(a);
      const facingAngle = a * c.turn;
      const tx = (w / 2) * Math.cos(facingAngle);
      const tz = (w / 2) * Math.sin(facingAngle);
      const drop = copy.drop * h * 1.6;
      // Hovering: up off the floor a little and back, each copy on its own
      // phase so the ring breathes rather than bounces
      const lift =
        c.hoverAmp > 0
          ? c.hoverAmp * h * Math.sin((TWO_PI * this.hoverClock) / c.hoverMs + copy.index * 1.9)
          : 0;
      const lx = cx - tx;
      const lz = cz - tz;
      const rx = cx + tx;
      const rz = cz + tz;
      const tl = project(lx, h + lift, lz);
      const tr = project(rx, h + lift, rz);
      const br = project(rx, lift, rz);
      const bl = project(lx, lift, lz);
      // How squarely the copy faces the eye: its width on the stage against
      // the width it would show face-on at that depth. Negative is its back
      const facing = clamp((tr.x - tl.x) / ((F * w) / cz), -1, 1);
      copy.facing = facing;
      copy.depth = cz;
      // Where it is drawn, drop included: the scene lifts the chosen copy from here
      copy.quad = [tl, tr, br, bl].map(p => ({x: p.x, y: p.y + drop}));
      const {mesh, mirror} = copy;
      mesh.setCorners(tl.x, tl.y + drop, tr.x, tr.y + drop, br.x, br.y + drop, bl.x, bl.y + drop);
      // The floor's mirror: the same copy upside down below the floor line,
      // sinking as the copy rises, the way a reflection does. It is raised
      // by twice the artwork's bottom margin, so it meets the pack itself
      // rather than the edge of its image, less the sliver of floor kept
      // between them
      const meet = 2 * (1 - this.contentBottom) * h - c.reflectionGap * h;
      const mtl = project(lx, -h - lift + meet, lz);
      const mtr = project(rx, -h - lift + meet, rz);
      const mbr = project(rx, -lift + meet, rz);
      const mbl = project(lx, -lift + meet, lz);
      mirror.setCorners(
        mtl.x, mtl.y - drop, mtr.x, mtr.y - drop, mbr.x, mbr.y - drop, mbl.x, mbl.y - drop,
      );
      // Gone for the moment it is edge-on (a sliver flickers), seen from
      // behind past it; and the ring sits in the dark away from the front:
      // the front copy is the one lit, the ones round the back darkest
      const visible = clamp(Math.abs(facing) / c.fade, 0, 1) * copy.fade;
      const lit = 1 - c.shade * ((1 - facing) / 2);
      const grey = Math.round(255 * lit);
      mesh.alpha = visible;
      mesh.tint = (grey << 16) | (grey << 8) | grey;
      mirror.alpha = visible * c.reflectionAlpha;
      mirror.tint = mesh.tint;
      order.push({copy, depth: cz});
    }
    // Draw order: back to front, so a near copy covers a far one
    order.sort((p, q) => q.depth - p.depth);
    for (const {copy} of order) {
      this.faces.addChild(copy.mesh);
      this.mirrors.addChild(copy.mirror);
    }
    // The floor's fade: whole from the horizon (the far copies' feet are up
    // there) to the front floor line, gone `reflectionHeight` below it. The
    // texture's whole part is its top two fifths, so the sprite is sized to
    // put the front floor line there
    const whole = this.floorY - horizonY;
    const height = Math.max(1, whole / 0.4);
    this.fade.position.set(rect.left - rect.width * 4, horizonY);
    this.fade.width = rect.width * 9;
    this.fade.height = Math.max(height, whole + h * c.reflectionHeight);
  }

  setAngle(angle) {
    this.angle = wrap(angle);
    this.place();
  }

  /** Neighbours of the chosen copy fading out, and the chosen one dropping. */
  setDrop(t) {
    for (const copy of this.copies) {
      if (copy.index === this.chosen) {
        copy.drop = t;
      } else {
        copy.fade = clamp(1 - t, 0, 1);
      }
    }
    this.place();
  }

  setAlpha(alpha) {
    this.node.alpha = alpha;
  }

  reset() {
    this.chosen = -1;
    for (const copy of this.copies) {
      copy.fade = 1;
      copy.drop = 0;
    }
    this.node.alpha = 1;
    this.place();
  }

  destroy() {
    this.fade.texture.destroy(true);
    this.node.destroy({children: true});
  }
}
