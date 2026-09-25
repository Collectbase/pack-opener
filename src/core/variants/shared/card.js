/**
 * The card that comes out of the pack: its artwork, the back it shows before
 * it turns, the glows around it and the beam that runs its outline. It owns
 * those nodes and every phase of the reveal — a scene hands it the pack rect,
 * the options and a time, and asks it to draw.
 *
 * Shared on purpose: how the wrapper comes apart is what makes a mechanic, but
 * the card that comes out is the same object every time. A variant picks how it
 * enters: slid past a cut lip, gathered and turned over in perspective (`park`
 * + `slide` + `charge` + `flipOver` + `land`), flipped flat (`reveal('flip')`),
 * or put there whole once something else has drawn its arrival (`place` +
 * `revealInstant`).
 */
import {
  Container,
  Graphics,
  MeshRope,
  PerspectiveMesh,
  Point,
  RenderTexture,
  Sprite,
  Texture,
} from 'pixi.js';
import {mixNumbers} from '../../runtime/color';
import {
  clamp,
  easeInOut,
  easeOut,
  jitterAt,
  outlinePath,
  pointAt,
  projectPoint,
} from './geometry';
import {
  EMBLEM_GLOW_SPAN,
  makeBloomTexture,
  makeCardBackTexture,
  makeCometTexture,
  makeEmblemGlowTexture,
  makeHaloTexture,
  makeSheenTexture,
  makeTwinkleTexture,
} from './textures';

/** Grid of the perspective meshes: fine enough that the artwork does not bend between vertices. */
const MESH_GRID = 10;

/**
 * Samples along the ribbon beam. Dense on purpose: a rope wider than the
 * corner radius folds on itself where the outline turns, and the fold shows
 * as spokes unless the turn is sampled finely.
 */
const RIBBON_POINTS = 96;

/** What hangs below the card: the gap, the stand and the air under it. */
function tailBelow(width, o) {
  const pedestal = o.layout.pedestal;

  return pedestal
    ? width * pedestal.gapRatio +
        width * pedestal.widthRatio * pedestal.aspect +
        width * (pedestal.clearanceRatio ?? 0)
    : 0;
}

/**
 * Where a card of `width` settles. The card is not alone down there — the
 * stand and its gap hang below it — so the pair is centred rather than the
 * card, or the stand ends up over whatever the host puts under the card.
 *
 * It is centred in what the host left free, but never sinks below the middle
 * of the stage: what a host hangs under the card — a price, buttons — was
 * laid out around a card that sits there, and it knows its own height better
 * than it can tell us before it is drawn. So a band claimed at the top buys
 * its room by making the pair smaller, not by pushing it down onto them.
 */
function restFor(width, screen, o) {
  const stage = o.layout.stage;
  const tail = tailBelow(width, o);
  const top = stage?.reserveTop ?? 0;
  const available = screen.height - top - (stage?.reserveBottom ?? 0);
  const centred = top + available / 2 - tail / 2;

  return Math.min(centred, screen.height / 2 - tail / 2);
}

/**
 * The card's size for a pack rect and where its centre comes to rest, from
 * the options alone — the maths `build` and `restingY` run, but callable
 * before the card exists, so a scene can lay the pack out around the card's
 * resting place (`layout.pack.anchor: 'card'`). `aspect` is the artwork's
 * when it is known, the layout's guess otherwise.
 */
export function cardLayoutFor(rect, screen, aspect, o) {
  const ratio = Math.min(aspect, o.layout.card.maxRatio);

  // A box the host gave outright: the artwork is fitted into it the way a
  // contained image is — by height when narrower than the box, by width
  // when wider — centred across and set on the box's bottom edge
  const box = o.rest?.card;
  if (box) {
    const fitByHeight = ratio <= box.width / box.height;
    const height = fitByHeight ? box.height : box.width / ratio;
    const width = fitByHeight ? height * ratio : box.width;
    return {width, height, restY: box.top + box.height - height / 2};
  }

  // Capping the width has to shrink the height too, or the card comes out
  // stretched and the artwork gets cropped
  let height = rect.height * o.layout.card.heightRatio;
  let width = height * ratio;
  const maxWidth = rect.width * o.layout.card.packWidthRatio;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / ratio;
  }

  // Whatever the host kept for itself is not the stage's to use: the card
  // and its stand give way together, so the pair still reads as one object.
  // Two things bound them — what is left of the stage, and twice the band
  // above, because the pair is not dropped below the middle of the stage to
  // clear it (see `restFor`).
  const stage = o.layout.stage;
  const reservedTop = stage?.reserveTop ?? 0;
  const available = screen.height - reservedTop - (stage?.reserveBottom ?? 0);
  const tailRatio = tailBelow(width, o) / height;
  const room = Math.min(available, screen.height - 2 * reservedTop);
  const maxHeight = room / (1 + tailRatio);
  if (height > maxHeight && maxHeight > 0) {
    const fit = maxHeight / height;
    width *= fit;
    height *= fit;
  }

  return {width, height, restY: restFor(width, screen, o)};
}

export class RevealCard {
  /** `sceneRoot` is the variant's own container, `screen` the renderer's size. */
  constructor(sceneRoot, screen, options, colors) {
    this.sceneRoot = sceneRoot;
    this.screen = screen;
    this.o = options;
    this.colors = colors;
    this.texture = null;
    this.node = null;
    // Set by `useDepth`: the card turns in perspective instead of flat
    this.renderer = null;
  }

  setOptions(options, colors) {
    this.o = options;
    this.colors = colors;
  }

  /**
   * Turn the card in perspective rather than squeezing it: its two sides
   * become meshes whose corners are projected every frame, so the edge
   * turning away gets shorter as it would on a real card. Needs the renderer
   * — the artwork's rounded face is baked into a texture a mesh can carry.
   * Called once, before the first `build`.
   */
  useDepth(renderer) {
    this.renderer = renderer;
  }

  /** Built once — a replay reuses the same card and just rewinds it. */
  get built() {
    return !!this.node;
  }

  get hasArt() {
    return !!this.texture;
  }

  get height() {
    return this.size.height;
  }

  /**
   * The artwork, whenever it arrives. A card built before it did was sized to
   * a guess at its shape (`layout.card.aspect`), and artwork of another shape
   * was cover-fitted into the guess — a slab lost the top and bottom of its
   * frame. So a card whose face has not been shown yet is built again to the
   * artwork's own shape. True when it was: the scene lays out again what it
   * placed against the card.
   */
  setTexture(texture) {
    this.texture = texture;
    if (!this.face || !texture) {
      return false;
    }
    if (this.face.alpha === 0 && !this.landed && this.misfits(texture)) {
      this.refit();
      return true;
    }
    this.face.texture = texture;
    this.fitFace();
    this.bakeFace();
    return false;
  }

  /** Whether the card was built to a shape the artwork does not have. */
  misfits(texture) {
    if (!texture.width || !texture.height) {
      return false;
    }
    const {width, height} = cardLayoutFor(
      this.rect,
      this.screen,
      texture.width / texture.height,
      this.o,
    );
    return (
      Math.abs(width - this.size.width) > 0.5 ||
      Math.abs(height - this.size.height) > 0.5
    );
  }

  /**
   * Built again to the artwork's shape, from where the card is now: its
   * place, its presence, its layer and the clip at the lip — and where it
   * comes to rest, which moves with its size. The phase that is playing
   * draws the rest on its next frame.
   */
  refit() {
    const {x, y} = this.node;
    const alpha = this.node.alpha;
    const scale = this.node.scale.x;
    const layer = this.sceneRoot.getChildIndex(this.node);
    const clipped = this.turn.mask === this.clipG;
    const {clipBottom, fromY, spinY} = this;
    const turnsAtPack = this.lifts;

    this.destroy();
    this.build(this.rect);
    this.sceneRoot.setChildIndex(
      this.node,
      Math.min(layer, this.sceneRoot.children.length - 1),
    );
    this.node.position.set(x, y);
    this.node.alpha = alpha;
    this.node.scale.set(scale);
    if (clipped) {
      this.turn.mask = this.clipG;
      this.clip(clipBottom);
    }
    if (this.placed) {
      this.fromY = fromY;
      this.toY = this.restingY();
      this.spinY = turnsAtPack ? spinY : this.toY;
    }
  }

  /** Whether the card has been put somewhere to come out from (`park` or `place`). */
  get placed() {
    return this.fromY !== undefined;
  }

  /**
   * The artwork as the mesh shows it while the card turns: cover-fitted and
   * rounded exactly like the flat face, rendered once into a texture of its
   * own. Multisampled, because the corners are cut by a mask, and a mask
   * rendered off screen without it leaves them stepped.
   */
  bakeFace() {
    if (!this.renderer || !this.faceMesh) {
      return;
    }
    const {width, height} = this.size;
    const holder = new Container();
    const art = new Sprite(this.texture || Texture.WHITE);
    art.anchor.set(0.5);
    art.position.set(width / 2, height / 2);
    if (this.texture && this.texture.width) {
      art.scale.set(
        Math.max(width / this.texture.width, height / this.texture.height),
      );
    } else {
      art.width = width;
      art.height = height;
    }
    const corners = new Graphics()
      .roundRect(0, 0, width, height, this.o.theme.cornerRadius)
      .fill(0xffffff);
    art.mask = corners;
    holder.addChild(art, corners);

    const target = RenderTexture.create({
      width,
      height,
      resolution: this.renderer.resolution,
      antialias: true,
    });
    this.renderer.render({container: holder, target, clear: true});
    // The artwork is still the flat face's, so only the holder goes
    holder.destroy({children: true});
    this.faceBaked?.destroy(true);
    this.faceBaked = target;
    this.faceMesh.texture = target;
  }

  /** Cover-fits the artwork into the card frame. */
  fitFace() {
    const texture = this.face?.texture;
    if (!texture || !texture.width) {
      return;
    }
    const {width, height} = this.size;
    const scale = Math.max(width / texture.width, height / texture.height);
    this.face.width = texture.width * scale;
    this.face.height = texture.height * scale;
    this.face.position.set(0, 0);
  }

  /** Where the card would come to rest for `rect`, before any card is built. */
  static restingCentre(screen, rect, options) {
    return cardLayoutFor(rect, screen, options.layout.card.aspect, options).restY;
  }

  build(rect) {
    // Kept, so the card can be built again once the artwork's shape is known
    this.rect = rect;
    const aspect = this.texture
      ? this.texture.width / this.texture.height
      : this.o.layout.card.aspect;
    const {width, height} = cardLayoutFor(rect, this.screen, aspect, this.o);
    this.size = {width, height};

    this.node = new Container();
    // In the pack's column — or the host's box's, when the host said where
    const box = this.o.rest?.card;
    this.node.position.set(
      box ? box.left + box.width / 2 : rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    this.node.alpha = 0;
    // Below the wrapper so the card looks like it slides out from inside
    this.sceneRoot.addChildAt(this.node, 0);

    const glow = this.o.layout.glow;

    this.bloom = new Sprite(makeBloomTexture(512, this.o.theme.bloom));
    this.bloom.anchor.set(0.5);
    this.bloom.width = width * glow.bloomScaleX;
    this.bloom.height = height * glow.bloomScaleY;
    this.bloom.blendMode = 'add';
    this.bloom.alpha = 0;

    // Tight white rim — the wide radial alone reads grey against the backdrop
    this.rim = new Sprite(
      makeHaloTexture(
        width,
        height,
        this.o.theme.rim,
        glow.rimSpread,
        this.o.theme.cornerRadius,
      ),
    );
    this.rim.anchor.set(0.5);
    this.rim.width = width + glow.rimPadding;
    this.rim.height = height + glow.rimPadding;
    this.rim.blendMode = 'add';
    this.rim.alpha = 0;

    this.halo = new Sprite(
      makeHaloTexture(
        width,
        height,
        this.o.theme.glow,
        glow.haloSpread,
        this.o.theme.cornerRadius,
      ),
    );
    this.halo.anchor.set(0.5);
    this.halo.width = width + glow.haloPadding;
    this.halo.height = height + glow.haloPadding;
    this.halo.blendMode = 'add';
    this.halo.alpha = 0;

    // Turned inside a wrapper so the spin does not skew the glows
    this.turn = new Container();

    this.face = new Sprite(this.texture || Texture.WHITE);
    this.face.anchor.set(0.5);
    const faceMask = new Graphics()
      .roundRect(-width / 2, -height / 2, width, height, this.o.theme.cornerRadius)
      .fill(0xffffff);
    this.face.mask = faceMask;

    this.back = new Sprite(makeCardBackTexture(width, height, this.o.theme));
    this.back.anchor.set(0.5);
    this.back.width = width;
    this.back.height = height;
    // Covers the card with its back; a flat turn drops it once the edge passes
    this.backMask = new Graphics();
    this.back.mask = this.backMask;

    // The highlight that runs across the artwork once the card is whole. Its
    // own mask, because a Graphics can only mask one thing
    const reveal = this.o.motion.reveal;
    this.sheen = new Sprite(
      makeSheenTexture(Math.round(width * reveal.sheenWidth), Math.round(height * 2)),
    );
    this.sheen.anchor.set(0.5);
    // Sized here rather than by the texture: `makeSheenTexture` bakes at the
    // device pixel ratio, so the sprite would come out twice as wide as asked
    this.sheen.width = width * reveal.sheenWidth;
    this.sheen.height = height * 2.2;
    this.sheen.blendMode = 'add';
    this.sheen.alpha = 0;
    this.sheen.visible = false;
    this.sheen.rotation = reveal.sheenTilt;
    const sheenMask = new Graphics()
      .roundRect(-width / 2, -height / 2, width, height, this.o.theme.cornerRadius)
      .fill(0xffffff);
    this.sheen.mask = sheenMask;

    this.beam = new Graphics();
    this.beamPath = outlinePath(
      width,
      height,
      this.o.theme.cornerRadius,
      this.o.motion.reveal.outlineDetail,
    );

    this.turn.addChild(
      this.face,
      faceMask,
      this.back,
      this.backMask,
      this.sheen,
      sheenMask,
      this.beam,
    );
    this.node.addChild(this.bloom, this.rim, this.halo, this.turn);

    // Hides whatever part of the card is still inside the wrapper
    this.clipG = new Graphics();
    this.sceneRoot.addChild(this.clipG);

    this.restX = this.node.x;
    this.rim.baseScaleX = this.rim.scale.x;
    this.glowBase = {
      rim: {x: this.rim.scale.x, y: this.rim.scale.y},
      halo: {x: this.halo.scale.x, y: this.halo.scale.y},
    };
    this.bloomBase = {x: this.bloom.scale.x, y: this.bloom.scale.y};
    this.face.alpha = 0;
    this.drawBackMask(1);
    this.fitFace();

    if (this.renderer) {
      this.buildDepth(width);
    }
  }

  /**
   * The two sides as meshes, the printed star's light over the back and the
   * glints that catch on the artwork once it lands. The flat back stays in
   * the tree for the mechanics that flip flat, but is not shown.
   */
  buildDepth(width) {
    this.backMesh = new PerspectiveMesh({
      texture: this.back.texture,
      verticesX: MESH_GRID,
      verticesY: MESH_GRID,
    });
    this.faceMesh = new PerspectiveMesh({
      texture: Texture.WHITE,
      verticesX: MESH_GRID,
      verticesY: MESH_GRID,
    });
    this.faceMesh.visible = false;

    this.emblem = new Sprite(makeEmblemGlowTexture(128));
    this.emblem.anchor.set(0.5);
    this.emblem.width = width * EMBLEM_GLOW_SPAN;
    this.emblem.height = width * EMBLEM_GLOW_SPAN;
    this.emblem.blendMode = 'add';
    this.emblem.alpha = 0;
    this.emblemBase = this.emblem.scale.x;

    this.twinkleTexture = makeTwinkleTexture(64);
    this.twinkles = [];

    this.back.visible = false;
    // Under the highlight and the beam, over nothing else of the card
    const at = this.turn.getChildIndex(this.backMask) + 1;
    this.turn.addChildAt(this.backMesh, at);
    this.turn.addChildAt(this.faceMesh, at + 1);
    this.turn.addChildAt(this.emblem, at + 2);
    this.bakeFace();
    this.pose(0, 0, 1);
  }

  /**
   * Stands the card at `yaw` / `pitch`, `lift` times its size: the side that
   * faces the eye shown as a mesh in perspective, the other hidden, and the
   * rim and halo stretched over the box the turned card covers — glows that
   * stay square while the card turns read as belonging to something else.
   * The projection is kept, so the beam can follow the same outline
   * (`viewPoint`).
   */
  pose(yaw, pitch, lift) {
    const {width, height} = this.size;
    const focal = this.focal ?? height * 3;
    const hw = (width / 2) * lift;
    const hh = (height / 2) * lift;
    const tl = projectPoint(-hw, -hh, yaw, pitch, focal);
    const tr = projectPoint(hw, -hh, yaw, pitch, focal);
    const br = projectPoint(hw, hh, yaw, pitch, focal);
    const bl = projectPoint(-hw, hh, yaw, pitch, focal);
    const facing = Math.cos(yaw) >= 0;

    this.backMesh.visible = facing;
    this.faceMesh.visible = !facing;
    if (facing) {
      this.backMesh.setCorners(tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
    } else {
      // The artwork is on the other side: its left edge is the back's right
      this.faceMesh.setCorners(tr.x, tr.y, tl.x, tl.y, bl.x, bl.y, br.x, br.y);
    }

    const minX = Math.min(tl.x, tr.x, br.x, bl.x);
    const maxX = Math.max(tl.x, tr.x, br.x, bl.x);
    const minY = Math.min(tl.y, tr.y, br.y, bl.y);
    const maxY = Math.max(tl.y, tr.y, br.y, bl.y);
    const sx = Math.max((maxX - minX) / width, 0.04);
    const sy = (maxY - minY) / height;
    for (const [glow, base] of [
      [this.rim, this.glowBase.rim],
      [this.halo, this.glowBase.halo],
    ]) {
      glow.scale.set(base.x * sx, base.y * sy);
      glow.position.set((minX + maxX) / 2, (minY + maxY) / 2);
    }

    this.emblem.visible = facing;
    this.emblem.scale.set(
      this.emblemBase * lift * Math.abs(Math.cos(yaw)),
      this.emblemBase * lift,
    );
    this.projection = {yaw, pitch, lift, focal};
  }

  /**
   * A point of the card's outline — in the card's own box, `0..width` across —
   * where it is drawn: through the pose while the card is turned, straight
   * about the centre otherwise.
   */
  viewPoint(x, y) {
    const {width, height} = this.size;
    const view = this.projection;
    if (!view) {
      return {x: x - width / 2, y: y - height / 2};
    }
    return projectPoint(
      (x - width / 2) * view.lift,
      (y - height / 2) * view.lift,
      view.yaw,
      view.pitch,
      view.focal,
    );
  }

  /** Everything above `bottomY` is visible; the rest is still in the wrapper. */
  clip(bottomY) {
    this.clipBottom = bottomY;
    const {width, height} = this.screen;
    this.clipG
      .clear()
      .rect(-width, -height, width * 3, height + bottomY)
      .fill(0xffffff);
  }

  /** `visible` is the share of the back still covering the card, top-down. */
  drawBackMask(visible) {
    const {width, height} = this.size;
    const covered = height * visible;
    this.backMask.clear();
    if (covered <= 0) {
      return;
    }
    this.backMask
      .rect(-width / 2 - 4, height / 2 - covered, width + 8, covered)
      .fill(0xffffff);
  }

  /**
   * `progress` runs the beam around the outline, `settled` fades the rim in.
   * Every point goes through `viewPoint`, so on a card turned in perspective the
   * beam runs the outline the eye sees rather than the square one.
   */
  drawBeam(progress, settled) {
    const {width, height} = this.size;
    const path = this.beamPath;
    const color = this.colors.glow;
    const reveal = this.o.motion.reveal;

    this.beam.clear();

    if (settled > 0) {
      if (this.projection) {
        const outline = path.points.map(p => this.viewPoint(p.x, p.y));
        this.beam.poly(outline.flatMap(p => [p.x, p.y]), true);
      } else {
        this.beam.roundRect(
          -width / 2,
          -height / 2,
          width,
          height,
          this.o.theme.cornerRadius,
        );
      }
      // Outside the edge, not on it: centred, half the line lay over the
      // artwork and read as the light cutting into the card
      this.beam.stroke({
        width: reveal.beamWidth,
        color,
        alpha: reveal.beamAlpha * settled,
        join: 'round',
        alignment: 0,
      });
    }
    if (progress <= 0 || progress >= 1) {
      this.hideRibbon();
      return;
    }

    const head = progress * path.total;
    const tail = path.total * reveal.beamTail;
    if (reveal.beamStyle === 'ribbon') {
      this.drawRibbon(head, tail);
      return;
    }
    this.hideRibbon();

    const steps = reveal.beamSteps;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const a = pointAt(path, head - tail * (1 - t0));
      const b = pointAt(path, head - tail * (1 - t1));
      const p0 = this.viewPoint(a.x, a.y);
      const p1 = this.viewPoint(b.x, b.y);
      const alpha = t1 * t1;
      this.beam
        .moveTo(p0.x, p0.y)
        .lineTo(p1.x, p1.y)
        .stroke({
          width: reveal.beamGlowWidth,
          color,
          alpha: alpha * reveal.beamGlowAlpha,
          cap: 'round',
        })
        .moveTo(p0.x, p0.y)
        .lineTo(p1.x, p1.y)
        .stroke({
          width: reveal.beamWidth,
          color: this.colors.beam,
          alpha,
          cap: 'round',
        });
    }

    const end = pointAt(path, head);
    const tip = this.viewPoint(end.x, end.y);
    this.beam
      .circle(tip.x, tip.y, reveal.beamTipRadius)
      .fill({color: this.colors.beam, alpha: reveal.beamAlpha});
  }

  /**
   * The beam in one piece. Each short stroke above is drawn on its own, and
   * once the card is big — a desktop stage — the round caps stop overlapping
   * and the trail reads as a row of dots. A rope lays one soft gradient along
   * the outline instead, continuous at any size: the wide glow in the rarity
   * colour, the bright core over it, the head rounded off by the texture so
   * no tip has to be drawn. Built the first time it is asked for, so a scene
   * that never draws it never carries it.
   */
  drawRibbon(head, tail) {
    const reveal = this.o.motion.reveal;
    if (!this.ribbon) {
      const points = [];
      for (let i = 0; i < RIBBON_POINTS; i++) {
        points.push(new Point(0, 0));
      }
      const glow = new MeshRope({
        texture: makeCometTexture(reveal.beamGlowWidth * 3),
        points,
      });
      glow.blendMode = 'add';
      const core = new MeshRope({
        texture: makeCometTexture(reveal.beamWidth * 3),
        points,
      });
      this.turn.addChild(glow, core);
      this.ribbon = {points, glow, core};
    }
    const {points, glow, core} = this.ribbon;
    const last = points.length - 1;
    for (let i = 0; i <= last; i++) {
      const p = pointAt(this.beamPath, head - tail * (1 - i / last));
      const at = this.viewPoint(p.x, p.y);
      points[i].set(at.x, at.y);
    }
    glow.tint = this.colors.glow;
    glow.alpha = Math.min(1, reveal.beamGlowAlpha * 2);
    core.tint = this.colors.beam;
    core.alpha = reveal.beamAlpha;
    glow.visible = true;
    core.visible = true;
  }

  hideRibbon() {
    if (this.ribbon) {
      this.ribbon.glow.visible = false;
      this.ribbon.core.visible = false;
    }
  }

  /** Where the card settles — see `restFor`; on the host's box's bottom edge when it gave one. */
  restingY() {
    const box = this.o.rest?.card;
    if (box) return box.top + box.height - this.size.height / 2;
    return restFor(this.size.width, this.screen, this.o);
  }

  /** Where the card came to rest, so React Native can build its UI around it. */
  bounds() {
    const {width, height} = this.size;
    const x = this.node.x;
    return {
      left: x - width / 2,
      right: x + width / 2,
      top: this.toY - height / 2,
      bottom: this.toY + height / 2,
      width,
      height,
    };
  }

  /**
   * The card and its glow. `t` is the whole open timeline: the glow leads, so by
   * the time the card clears the lip it is already lit — catching up afterwards
   * looked like the card switched its light on late. `bloomLevel` and
   * `bloomTint` let a mechanic keep that light low and warm, for a card whose
   * own colour is still to come.
   */
  slide(t, bloomLevel = 1, bloomTint = 0xffffff) {
    const glow = clamp(t / this.o.motion.open.cardFrom, 0, 1);
    this.bloom.alpha = glow * bloomLevel;
    this.bloom.tint = bloomTint;
    this.rim.alpha = glow * this.o.motion.reveal.rimAlpha;

    const p = clamp((t - this.o.motion.open.cardFrom) / (1 - this.o.motion.open.cardFrom), 0, 1);
    const eased = easeOut(p);
    const target = this.spinY ?? this.toY;
    this.node.y = this.fromY + (target - this.fromY) * eased;
  }

  /**
   * The flat phases other mechanics build their reveal from: `spinHold` — the
   * card turning on at one steady speed while its artwork is on its way, a
   * whole turn per hold so it can run on for as many as it takes; `flip` —
   * half a turn from the back to the artwork; `hold` — the finished card with
   * its halo and lit outline.
   */
  reveal(kind, t) {
    const reveal = this.o.motion.reveal;

    if (kind === 'spinHold') {
      const cos = Math.cos(Math.PI * 2 * t);
      const flat = Math.max(Math.abs(cos), reveal.spinFlatness);
      // Scale alone reads as a turn; skewing on top of it looks like the card
      // is bent rather than rotating
      this.turn.scale.x = flat;
      const shade = 1 - reveal.spinShade + reveal.spinShade * Math.abs(cos);
      const tint = Math.round(255 * shade);
      this.back.tint = (tint << 16) | (tint << 8) | tint;
      this.bloom.alpha =
        reveal.spinBloom + (1 - reveal.spinBloom) * Math.abs(cos);
      this.rim.alpha = reveal.rimAlpha;
      this.rim.scale.x = this.rim.baseScaleX * flat;
      return;
    }

    if (kind === 'flip') {
      // Half a turn: face down going in, edge-on at the middle, the artwork
      // facing out past it. The back is only ever seen on the way in, so the
      // blank is dropped the frame the edge passes and never wiped
      const eased = easeInOut(t);
      const angle = Math.PI * eased;
      const cos = Math.cos(angle);
      const flat = Math.max(Math.abs(cos), reveal.spinFlatness);
      // The scene brings the card in (`setAlpha`); the flip only turns it
      this.node.y = this.toY;
      this.turn.scale.x = flat;
      this.turn.mask = null;
      const past = cos < 0;
      this.face.alpha = past ? 1 : 0;
      this.drawBackMask(past ? 0 : 1);
      const shade = 1 - reveal.spinShade + reveal.spinShade * Math.abs(cos);
      const tint = Math.round(255 * shade);
      this.back.tint = (tint << 16) | (tint << 8) | tint;
      this.rim.alpha = reveal.rimAlpha;
      this.rim.scale.x = this.rim.baseScaleX * flat;
      // The halo comes up with the artwork, and swells as the card lands
      const landing = clamp((t - 0.5) * 2, 0, 1);
      this.halo.alpha = reveal.haloAlpha * landing;
      this.bloom.alpha = reveal.bloomAlpha * (1 - eased);
      this.pulse(Math.sin(Math.PI * landing) * 0.6);
      return;
    }

    if (kind === 'hold') {
      this.drawBeam(1, 1);
      this.halo.alpha = reveal.haloAlpha;
    }
  }

  /**
   * Face down at rest, gathering itself before it turns — a card built with
   * `useDepth`. It sways a little in perspective, a beam in its colour runs
   * the edge faster and faster, the printed star and the halo fill with that
   * colour, and towards the end it trembles. `level` runs 0..1 over the
   * build-up and stays at 1 while the artwork is late; `clock` is ms since it
   * began, so the sway and the beam carry on unbroken through the wait. `fx`
   * is the mechanic's own numbers (`slice`).
   */
  charge(level, clock, fx, colors) {
    const reveal = this.o.motion.reveal;
    const energy = level * level;
    this.focal = fx.focal * this.size.height;

    const tilt = (fx.tiltDeg * Math.PI) / 180;
    const sway = (2 * Math.PI * clock) / fx.tiltMs;
    const yaw = tilt * Math.sin(sway);
    const pitch = tilt * 0.45 * Math.cos(sway * 0.77);
    this.turnedFrom = {yaw, pitch};
    this.pose(yaw, pitch, 1 + 0.02 * energy);

    const shake = fx.tremble * clamp((level - 0.55) / 0.45, 0, 1);
    this.node.x = this.restX + shake * Math.sin(clock * 0.083);
    this.node.y = this.spinY + shake * Math.cos(clock * 0.107);

    const flicker = 1 + 0.12 * energy * Math.sin(clock * 0.021);
    this.bloom.tint = mixNumbers(colors.seam, colors.glow, energy);
    this.bloom.alpha = reveal.bloomAlpha * (0.3 + 0.45 * energy) * flicker;
    this.rim.alpha = reveal.rimAlpha * (0.45 + 0.55 * energy);
    this.halo.alpha = Math.min(
      1,
      reveal.haloAlpha * fx.chargeHalo * energy * flicker,
    );
    this.emblem.tint = colors.glow;
    this.emblem.alpha = Math.min(1, fx.emblemAlpha * (0.2 + 0.8 * energy) * flicker);

    // Laps pick up speed: the beam is slow while the card settles and racing
    // by the time it turns
    const laps = fx.chargeLaps * Math.pow(clock / fx.chargeMs, 1.5);
    this.drawBeam(laps % 1, 0.2 + 0.8 * energy);
  }

  /** The turn starts from wherever the sway left the card, so it never jumps. */
  beginFlip() {
    this.flipFrom = this.turnedFrom ?? {yaw: 0, pitch: 0};
  }

  /**
   * Half a turn in perspective, the card coming up towards the eye as it goes
   * and settling back as the artwork squares up. Its own light flares as the
   * edge passes — the moment the colour is the whole card — and the beam
   * hands its light over to the turn.
   */
  flipOver(t, fx, colors) {
    const reveal = this.o.motion.reveal;
    const from = this.flipFrom ?? {yaw: 0, pitch: 0};
    const eased = easeInOut(t);
    const arc = Math.sin(Math.PI * t);
    const yaw = from.yaw + (Math.PI - from.yaw) * eased;
    this.pose(yaw, from.pitch * (1 - eased), 1 + fx.flipLift * arc);
    this.node.x = this.restX;
    this.node.y = this.spinY - this.size.height * fx.flipRise * arc;

    const edge = Math.exp(-Math.pow((t - 0.5) / 0.2, 2));
    this.bloom.tint = colors.glow;
    this.bloom.alpha = Math.min(
      1,
      reveal.bloomAlpha * (0.75 + fx.flipFlare * edge),
    );
    this.bloom.scale.set(
      this.bloomBase.x * (1 + 0.18 * edge),
      this.bloomBase.y * (1 + 0.18 * edge),
    );
    // Squeezed edge-on, the tight rim is a bar of light taller than the card
    this.rim.alpha = reveal.rimAlpha * (0.3 + 0.7 * Math.abs(Math.cos(yaw)));
    this.halo.alpha = Math.min(
      1,
      reveal.haloAlpha * (fx.chargeHalo + (1 - fx.chargeHalo) * eased),
    );
    this.emblem.alpha = fx.emblemAlpha * clamp(1 - eased * 2.2, 0, 1);
    this.drawBeam(0, clamp(1 - t * 2.5, 0, 1));
  }

  /**
   * The artwork squared up, landing: a push out and back, its outline
   * swelling, the highlight crossing it and glints catching on it one after
   * another. `elapsed` is ms since it landed. The meshes hand over to the flat
   * face at the first frame — the same pixels, square — so the card at rest
   * is the one every mechanic ends on.
   */
  land(t, elapsed, fx) {
    const reveal = this.o.motion.reveal;
    if (!this.landed) {
      this.squareUp();
    }
    const push = clamp(t / 0.5, 0, 1);
    this.setScale(1 + fx.landPunch * Math.sin(Math.PI * push) * (1 - push * 0.4));
    if (this.lifts) {
      this.node.y = this.spinY + (this.toY - this.spinY) * easeInOut(t);
    }
    this.pulse(Math.sin(Math.PI * clamp(t / 0.75, 0, 1)));
    this.sweepSheen(clamp((elapsed - 60) / reveal.sheenMs, 0, 1));
    this.twinkle(elapsed, fx);
    this.bloom.alpha = reveal.bloomAlpha * (0.2 + 0.8 * Math.pow(1 - t, 2));
    this.bloom.scale.set(this.bloomBase.x, this.bloomBase.y);
    this.drawBeam(0, clamp(t * 2, 0, 1));
  }

  /** From the meshes to the flat card: artwork up, glows square, no projection. */
  squareUp() {
    this.landed = true;
    this.projection = null;
    this.backMesh.visible = false;
    this.faceMesh.visible = false;
    this.emblem.visible = false;
    this.face.alpha = 1;
    this.node.x = this.restX;
    this.rim.position.set(0, 0);
    this.halo.position.set(0, 0);
    this.rim.scale.set(this.glowBase.rim.x, this.glowBase.rim.y);
    this.halo.scale.set(this.glowBase.halo.x, this.glowBase.halo.y);
  }

  /**
   * Glints on the artwork: four-pointed stars that flash up and go, one after
   * another, all of them over within the landing. Scattered by a fixed noise,
   * so the same card catches the light in the same places every time.
   */
  twinkle(elapsed, fx) {
    const count = Math.max(0, Math.round(fx.twinkles));
    while (this.twinkles.length < count) {
      const glint = new Sprite(this.twinkleTexture);
      glint.anchor.set(0.5);
      glint.blendMode = 'add';
      glint.visible = false;
      this.turn.addChild(glint);
      this.twinkles.push(glint);
    }
    const {width, height} = this.size;
    const span = Math.max(0, fx.landMs - fx.twinkleMs - 80);
    this.twinkles.forEach((glint, i) => {
      const start = 60 + (count > 1 ? (span * i) / (count - 1) : 0);
      const u = (elapsed - start) / fx.twinkleMs;
      if (i >= count || u <= 0 || u >= 1) {
        glint.visible = false;
        return;
      }
      const flash = Math.sin(Math.PI * u);
      const size = fx.twinkleSize * (0.7 + 0.5 * Math.abs(jitterAt(i, 7.7))) * flash;
      glint.visible = true;
      glint.position.set(
        width * 0.4 * jitterAt(i, 2.3),
        height * 0.42 * jitterAt(i, 5.1),
      );
      glint.width = size;
      glint.height = size;
      glint.rotation = i + u * 0.6;
      glint.alpha = flash;
      glint.tint = this.colors.spark;
    });
  }

  hideTwinkles() {
    for (const glint of this.twinkles ?? []) {
      glint.visible = false;
    }
  }

  /** Puts the revealed card back inside the pack so a replay starts clean. */
  rewind(rect) {
    if (!this.node) {
      return;
    }
    this.node.alpha = 0;
    this.node.x = this.restX;
    this.node.y = rect.top + rect.height / 2;
    this.node.scale.set(1);
    this.bloom.alpha = 0;
    this.bloom.tint = 0xffffff;
    this.bloom.scale.set(this.bloomBase.x, this.bloomBase.y);
    this.rim.alpha = 0;
    this.rim.position.set(0, 0);
    this.rim.scale.set(this.glowBase.rim.x, this.glowBase.rim.y);
    this.halo.alpha = 0;
    this.halo.position.set(0, 0);
    this.halo.scale.set(this.glowBase.halo.x, this.glowBase.halo.y);
    this.sheen.visible = false;
    this.turn.scale.x = 1;
    this.back.tint = 0xffffff;
    this.beam.clear();
    this.hideRibbon();
    this.face.alpha = 0;
    this.drawBackMask(1);
    if (this.backMesh) {
      this.landed = false;
      this.turnedFrom = null;
      this.emblem.alpha = 0;
      this.hideTwinkles();
      this.pose(0, 0, 1);
    }
  }

  /**
   * Parked just below the lip, so the card starts out of sight inside the
   * wrapper and the clip alone decides how much of it shows.
   */
  park(cutY, rect) {
    this.fromY = cutY + this.size.height / 2;
    this.node.y = this.fromY;
    this.node.alpha = 1;
    this.toY = this.restingY();
    // Where the card turns: at rest, or where the pack was — then it lifts
    // onto its stand as it lands (see `land`)
    this.spinY =
      this.o.layout.card.spinAt === 'pack' && rect
        ? rect.top + rect.height / 2
        : this.toY;
    this.turn.mask = this.clipG;
    this.clip(cutY);
  }

  /** Whether the card still has to rise onto its stand after it turns. */
  get lifts() {
    return this.spinY !== undefined && this.spinY !== this.toY;
  }

  /**
   * Sat where the pack was, invisible, with nothing clipping it. A mechanic
   * that blows the wrapper apart has no lip for the card to slide past — the
   * card is simply not there until the blast puts it there.
   */
  place(rect) {
    this.fromY = rect.top + rect.height / 2;
    this.toY = this.restingY();
    this.node.y = this.fromY;
    this.node.alpha = 0;
    this.node.scale.set(1);
    this.turn.mask = null;
  }

  /**
   * The finished card, with no reveal played into it: face up, square, at rest
   * where it will stay. A mechanic that reveals the card some other way — by
   * assembling it out of particles, say — draws its own build-up and then hands
   * over to this.
   */
  revealInstant() {
    this.node.alpha = 1;
    this.node.scale.set(1);
    this.node.y = this.toY;
    this.turn.scale.x = 1;
    this.turn.mask = null;
    this.back.tint = 0xffffff;
    this.face.alpha = 1;
    // The back is out of sight for good
    this.drawBackMask(0);
    this.beam.clear();
    this.hideRibbon();
  }

  /**
   * How present the finished card is. A mechanic that hands over to it from
   * something else — pieces flying into place, say — brings it up underneath
   * rather than swapping it in, so the eye never catches the change.
   */
  setAlpha(alpha) {
    this.node.alpha = alpha;
  }

  /** The rarity halo on its own, for a finish that has no beam to run. */
  setHalo(alpha) {
    this.halo.alpha = alpha * this.o.motion.reveal.haloAlpha;
  }

  /**
   * A swell of light around the card's own outline — `p` runs 0..1 and back.
   * It is the card's silhouette that flares, not a ring drawn near it, which
   * is what keeps a loud moment from reading as a second explosion.
   */
  pulse(p) {
    const reveal = this.o.motion.reveal;
    this.rim.alpha = Math.min(1, reveal.rimAlpha * (1 + p * reveal.pulseRim));
    this.halo.alpha = Math.min(1, reveal.haloAlpha * (1 + p * reveal.pulseHalo));
    const grow = 1 + p * reveal.pulseSpread;
    this.rim.scale.set(this.glowBase.rim.x * grow, this.glowBase.rim.y * grow);
    this.halo.scale.set(this.glowBase.halo.x * grow, this.glowBase.halo.y * grow);
  }

  /**
   * The highlight crossing the artwork. `t` runs 0..1 over `reveal.sheenMs`;
   * masked by the card, so it reads as light on the card rather than as light
   * thrown at it.
   */
  sweepSheen(t) {
    if (t <= 0 || t >= 1) {
      this.sheen.visible = false;
      return;
    }
    const travel = this.size.width * 1.9;
    this.sheen.visible = true;
    this.sheen.position.set(
      (t - 0.5) * travel,
      -(t - 0.5) * travel * Math.tan(this.sheen.rotation) * 0.5,
    );
    this.sheen.alpha = Math.sin(Math.PI * t) * this.o.motion.reveal.sheenAlpha;
  }

  /** A short push out and back, so the card lands rather than appears. */
  setScale(value) {
    this.node.scale.set(value);
  }

  /**
   * Dropped whole before a rebuild bakes the options into new textures. The
   * ribbon's textures are ours to free, but only once the ropes are gone — a
   * destroyed mesh has let go of its texture, so the references are taken
   * first and released last.
   */
  destroy() {
    const textures = this.ribbon
      ? [this.ribbon.glow.texture, this.ribbon.core.texture]
      : [];
    this.ribbon = null;
    this.node?.destroy({children: true});
    this.clipG?.destroy();
    for (const texture of textures) {
      texture?.destroy(true);
    }
    // Baked for this card's size: the next build bakes its own
    this.faceBaked?.destroy(true);
    this.twinkleTexture?.destroy(true);
    this.faceBaked = null;
    this.backMesh = null;
    this.faceMesh = null;
    this.twinkles = [];
    this.node = null;
  }
}
