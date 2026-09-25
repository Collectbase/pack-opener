/**
 * The pack itself: one uncut copy plus the two halves the cut separates, each
 * carrying a mask built from the finger trail, and the light that makes it
 * read as foil — a glint crossing it while it waits and a glow round its own
 * outline. Nothing is drawn on the cut: it is the pack coming apart, and the
 * slit shows the stage behind it. It owns those nodes and the motion that
 * throws the lid away and sinks what is left — the scene only tells it how
 * far the gesture has come.
 *
 * Everything sits in one container, so the untouched pack floats and jolts as
 * one piece; the masks are drawn in that container's space. What the scene
 * hangs on the pack — the hint, the light under the blade — is carried in it
 * too.
 */
import {Container, Graphics, Sprite, Texture} from 'pixi.js';
import {clamp, easeInOut, easeOut, jitterAt} from './geometry';
import {
  makeHaloTexture,
  makeSheenTexture,
  makeSilhouetteGlowTexture,
} from '../shared/textures';

/**
 * The box every mask has to cover: the pack, and the margins of its image —
 * a margin is transparent, but a soft shadow drawn in it is not, and a mask
 * that stopped at the pack would cut it off.
 */
function outerBox(rect) {
  const image = rect.image ?? rect;
  return {
    left: Math.min(rect.left, image.left),
    right: Math.max(rect.right, image.left + image.width),
    top: Math.min(rect.top, image.top),
    bottom: Math.max(rect.bottom, image.top + image.height),
  };
}

/**
 * The torn edge of one half. It follows the finger trail but is pushed off it
 * by a gap that closes to nothing at the blade, so the untouched part of the
 * pack stays seamless, and it runs straight back from the first point to past
 * the pack's far edge along the trail's first slope — a cut started halfway
 * across is still a cut through the whole pack behind the finger. `sign` is
 * which half: -1 the lid, 1 the rest. Null until there is a trail to tear.
 */
function tearEdge(points, rect, dir, sign, openness, interaction) {
  const n = points.length;
  if (n < 2 || dir === 0) {
    return null;
  }
  const {overshoot, rampPoints, edgeJitter} = interaction;
  const box = outerBox(rect);
  // Only the finger widens the cut. Once it is committed the shape is frozen and
  // the halves come apart by moving — otherwise the edge travels twice as fast
  // as the sprite carrying it and the seam visibly jumps.
  const gapScale = rect.gap * openness;
  const phase = sign < 0 ? 0 : 2.7;

  const edge = points.map((point, index) => {
    const ramp = Math.min((n - 1 - index) / rampPoints, 1);
    const gap = gapScale * ramp;
    return {
      x: point.x,
      y: point.y + sign * (gap + jitterAt(index, phase) * gap * edgeJitter),
    };
  });

  const first = points[0];
  const backDx = points[1].x - first.x;
  const backSlope =
    backDx !== 0 ? clamp((points[1].y - first.y) / backDx, -1.1, 1.1) : 0;
  const backAt = x => ({x, y: edge[0].y + backSlope * (x - first.x)});

  return {
    edge,
    back: backAt(dir > 0 ? box.left - overshoot : box.right + overshoot),
    // The blade itself carries no gap — that is what hides the seam ahead of it
    blade: points[n - 1],
    before: points[n - 2],
  };
}

/** Along a torn edge, smoothed the way the mask is, from its first point to the blade. */
function traceEdge(g, tear) {
  const {edge} = tear;
  for (let i = 0; i < edge.length - 1; i++) {
    const a = edge[i];
    const b = edge[i + 1];
    g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  g.lineTo(tear.blade.x, tear.blade.y);
}

/** One half of the wrapper as a mask: everything on its side of the torn edge. */
function drawTearMask(g, tear, rect, dir, sign, interaction) {
  g.clear();
  if (!tear) {
    return;
  }
  const {overshoot} = interaction;
  const box = outerBox(rect);
  const frontX = dir > 0 ? box.right + overshoot : box.left - overshoot;
  const cornerY = sign < 0 ? box.top - overshoot : box.bottom + overshoot;
  const {back, blade, before} = tear;
  const frontDx = blade.x - before.x;
  const frontSlope =
    frontDx !== 0 ? clamp((blade.y - before.y) / frontDx, -1.1, 1.1) : 0;

  g.moveTo(back.x, cornerY);
  g.lineTo(back.x, back.y);
  g.lineTo(tear.edge[0].x, tear.edge[0].y);
  traceEdge(g, tear);
  g.lineTo(frontX, blade.y + frontSlope * (frontX - blade.x));
  g.lineTo(frontX, cornerY);
  g.closePath();
  g.fill(0xffffff);
}

/** The part of the pack the blade has not reached yet — still one solid piece. */
function drawUncutMask(g, points, rect, dir, OVERSHOOT) {
  const n = points.length;
  const box = outerBox(rect);
  const top = box.top - OVERSHOOT;
  const height = box.bottom - box.top + OVERSHOOT * 2;
  g.clear();

  if (n < 2 || dir === 0) {
    g.rect(box.left - OVERSHOOT, top, box.right - box.left + OVERSHOOT * 2, height);
    g.fill(0xffffff);
    return;
  }

  const bladeX = points[n - 1].x;
  const left = dir > 0 ? bladeX - 0.5 : box.left - OVERSHOOT;
  const right = dir > 0 ? box.right + OVERSHOOT : bladeX + 0.5;
  if (right - left <= 0) {
    return;
  }
  g.rect(left, top, right - left, height);
  g.fill(0xffffff);
}

export class PackWrapper {
  constructor(root, texture, rect, options) {
    this.texture = texture;
    this.o = options;
    this.node = new Container();
    root.addChild(this.node);

    // Behind the artwork: light round the pack's own outline
    this.backlight = new Sprite(Texture.EMPTY);
    this.backlight.blendMode = 'add';
    this.backlight.alpha = 0;

    this.uncut = new Sprite(texture);
    this.bottom = new Sprite(texture);
    this.top = new Sprite(texture);

    this.uncutMask = new Graphics();
    this.bottomMask = new Graphics();
    this.topMask = new Graphics();


    // The light crossing the foil, held to the pack's own silhouette by a
    // mask cut from the artwork itself
    this.foilMask = new Sprite(texture);
    this.foil = new Sprite(Texture.EMPTY);
    this.foil.anchor.set(0.5);
    this.foil.blendMode = 'add';
    this.foil.visible = false;

    // Masks have to live in the scene graph for Pixi to render them
    this.node.addChild(
      this.backlight,
      this.uncutMask,
      this.bottomMask,
      this.topMask,
      this.bottom,
      this.top,
      this.uncut,
      this.foilMask,
      this.foil,
    );
    this.uncut.mask = this.uncutMask;
    this.bottom.mask = this.bottomMask;
    this.top.mask = this.topMask;
    this.foil.mask = this.foilMask;

    this.clock = 0;
    // 1 while the pack is left alone, 0 once a finger is on it
    this.calm = 1;
    // 1 while the pack is whole, 0 once the lid is off
    this.lit = 1;
    this.offsetY = 0;
    this.jolt = 0;

    this.layout(rect);
  }

  setOptions(options) {
    this.o = options;
  }

  /** Something the scene hangs on the pack: it floats and jolts with it. */
  carry(view) {
    this.node.addChild(view);
  }

  /** Called again whenever the pack rect changes — a resize or a rebuild. */
  layout(rect) {
    this.rect = rect;
    const image = rect.image ?? rect;
    for (const part of [this.uncut, this.bottom, this.top, this.foilMask]) {
      part.position.set(image.left, image.top);
      part.width = image.width;
      part.height = image.height;
    }

    const fx = this.o.slice;
    this.replaceTexture(
      this.foil,
      makeSheenTexture(
        Math.max(1, Math.round(rect.width * fx.foilWidth)),
        Math.max(1, Math.round(rect.height * 1.8)),
      ),
    );
    // Sized here, not by the texture: it is baked at the device pixel ratio
    this.foil.width = rect.width * fx.foilWidth;
    this.foil.height = rect.height * 1.8;
    this.foil.rotation = fx.foilTilt;

    // Round the pack's own outline when its pixels can be read, round its
    // box otherwise — softly enough that the difference hardly shows
    const spread = fx.backlightSpread;
    const silhouette = makeSilhouetteGlowTexture(
      this.texture,
      image.width,
      image.height,
      spread,
    );
    const box = silhouette ? image : rect;
    this.replaceTexture(
      this.backlight,
      silhouette ??
        makeHaloTexture(
          rect.width,
          rect.height,
          '#ffffff',
          spread,
          Math.min(rect.width, rect.height) * 0.04,
        ),
    );
    this.backlight.position.set(box.left - spread, box.top - spread);
    this.backlight.width = box.width + spread * 2;
    this.backlight.height = box.height + spread * 2;

    this.applyTransform();
  }

  replaceTexture(sprite, texture) {
    const before = sprite.texture;
    sprite.texture = texture;
    if (before && before !== Texture.EMPTY && before !== texture) {
      before.destroy(true);
    }
  }

  /**
   * The float and the jolt, about the pack's own middle. The pack is where
   * the layout put it whenever both are at rest, so the cut and the card are
   * measured in the same space as the stage.
   */
  applyTransform() {
    const {rect} = this;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    this.node.pivot.set(cx, cy);
    this.node.position.set(cx, cy + this.offsetY);
    this.node.scale.set(1 + this.jolt);
  }

  /**
   * Life of the waiting pack: it floats, light crosses its foil, its outline
   * glows. `touched` settles all of it away — the cut needs the pack still,
   * and a pack drifting under the blade would pull the seam off the finger.
   * `opened` puts the outline's light out: the silhouette it follows is gone
   * with the lid.
   */
  update(deltaMS, {touched, opened}, colors) {
    const fx = this.o.slice;
    const {rect} = this;
    this.clock += deltaMS;
    this.calm += ((touched ? 0 : 1) - this.calm) * Math.min(1, deltaMS / 140);
    this.lit += ((opened ? 0 : 1) - this.lit) * Math.min(1, deltaMS / 200);

    this.offsetY =
      fx.floatAmp *
      rect.height *
      Math.sin((2 * Math.PI * this.clock) / fx.floatMs) *
      this.calm;
    this.applyTransform();

    const pass = (this.clock % fx.foilEveryMs) / fx.foilMs;
    if (pass < 1 && fx.foilAlpha > 0 && this.calm > 0.02) {
      const travel = rect.width + this.foil.width;
      this.foil.visible = true;
      this.foil.position.set(
        rect.left - this.foil.width / 2 + travel * easeInOut(pass),
        rect.top + rect.height / 2,
      );
      this.foil.alpha = fx.foilAlpha * Math.sin(Math.PI * pass) * this.calm;
    } else {
      this.foil.visible = false;
    }

    // Breathes on a beat of its own, so it never lines up with the float
    const breath =
      0.8 + 0.2 * Math.sin((2 * Math.PI * this.clock) / (fx.floatMs * 0.73));
    this.backlight.alpha = fx.backlightAlpha * breath * this.lit;
    this.backlight.tint = colors.rim;
    this.backlight.visible = this.backlight.alpha > 0.005;
  }

  /** The pack giving at the moment the seal goes: a push out and back, `t` over the run-out. */
  setJolt(t) {
    this.jolt = this.o.slice.joltScale * Math.sin(Math.PI * clamp(t, 0, 1));
    this.applyTransform();
  }

  redraw(trail, dir, openness, interaction) {
    const {rect} = this;
    drawUncutMask(this.uncutMask, trail, rect, dir, interaction.overshoot);
    drawTearMask(
      this.topMask,
      tearEdge(trail, rect, dir, -1, openness, interaction),
      rect,
      dir,
      -1,
      interaction,
    );
    drawTearMask(
      this.bottomMask,
      tearEdge(trail, rect, dir, 1, openness, interaction),
      rect,
      dir,
      1,
      interaction,
    );
  }

  /** Both halves home and opaque again, for a replay. */
  reset() {
    this.top.alpha = 1;
    this.bottom.alpha = 1;
    this.uncut.alpha = 1;
    this.jolt = 0;
    this.moveHalf(this.top, this.topMask, 0, 0);
    this.moveHalf(this.bottom, this.bottomMask, 0, 0);
    this.applyTransform();
  }

  /**
   * Moves one half of the wrapper together with its mask. The mask paths are
   * built in the pack's space, so a sprite that moves on its own slides out
   * from under its own cut — and the half starts showing the wrong part of the
   * artwork, which reads as an uncut pack.
   */
  moveHalf(sprite, mask, dx, dy, rotation = 0) {
    const image = this.rect.image ?? this.rect;
    sprite.position.set(image.left + dx, image.top + dy);
    sprite.rotation = rotation;
    mask.pivot.set(image.left, image.top);
    mask.position.set(image.left + dx, image.top + dy);
    mask.rotation = rotation;
  }

  /** The lid flying off. Owns nothing but the top half. */
  applyLid(release, dir, open) {
    const {rect} = this;
    this.moveHalf(
      this.top,
      this.topMask,
      dir * release * rect.width * open.lidThrowX,
      -release * rect.height * open.lidThrowY,
      dir * release * open.lidSpin,
    );
    this.top.alpha =
      1 - clamp((release - open.lidFadeFrom) / open.lidFadeSpan, 0, 1);
  }

  /**
   * The emptied wrapper: how far it has sunk and how far it has faded. Returns
   * the drop, because the card clip is cut at the sunken lip — computing that
   * twice let the two disagree for a frame and the wrapper visibly jumped.
   */
  sink(t, open) {
    const {rect} = this;
    const drop = rect.height * open.sink * easeOut(t);
    this.moveHalf(this.bottom, this.bottomMask, 0, drop);

    // Sinking and fading are one motion, not one after the other
    const gone = clamp(t / open.gone, 0, 1);
    this.bottom.alpha = 1 - gone;
    // The uncut copy has no business being visible past the tear
    this.uncut.alpha = 1 - clamp(t / open.uncutFade, 0, 1);

    return drop;
  }
}
