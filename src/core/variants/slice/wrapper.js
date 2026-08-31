/**
 * The pack itself: one uncut copy plus the two halves the cut separates, each
 * carrying a mask built from the finger trail. It owns those six nodes and the
 * motion that throws the lid away and sinks what is left — the scene only tells
 * it how far the gesture has come.
 */
import {Graphics, Sprite} from 'pixi.js';
import {clamp, easeOut, jitterAt} from './geometry';

/**
 * Draws one half of the wrapper into a mask. The edge follows the finger trail
 * but is pushed away from the cut by a gap that fades to zero at the blade, so
 * the untouched part of the pack stays seamless.
 */
function drawTearMask(g, points, rect, dir, sign, openness, interaction) {
  const n = points.length;
  g.clear();
  if (n < 2 || dir === 0) {
    return;
  }

  const {
    overshoot: OVERSHOOT,
    rampPoints: RAMP_POINTS,
    edgeJitter: EDGE_JITTER,
  } = interaction;
  const backX = dir > 0 ? rect.left - OVERSHOOT : rect.right + OVERSHOOT;
  const frontX = dir > 0 ? rect.right + OVERSHOOT : rect.left - OVERSHOOT;
  const cornerY = sign < 0 ? rect.top - OVERSHOOT : rect.bottom + OVERSHOOT;
  // Only the finger widens the cut. Once it is committed the shape is frozen and
  // the halves come apart by moving — otherwise the edge travels twice as fast
  // as the sprite carrying it and the seam visibly jumps.
  const gapScale = rect.gap * openness;
  const phase = sign < 0 ? 0 : 2.7;

  const edgeY = index => {
    const ramp = Math.min((n - 1 - index) / RAMP_POINTS, 1);
    const gap = gapScale * ramp;
    return (
      points[index].y + sign * (gap + jitterAt(index, phase) * gap * EDGE_JITTER)
    );
  };

  const first = points[0];
  const firstY = edgeY(0);
  const backDx = points[1].x - first.x;
  const backSlope =
    backDx !== 0 ? clamp((points[1].y - first.y) / backDx, -1.1, 1.1) : 0;

  g.moveTo(backX, cornerY);
  g.lineTo(backX, firstY + backSlope * (backX - first.x));
  g.lineTo(first.x, firstY);

  for (let i = 0; i < n - 1; i++) {
    const cx = points[i].x;
    const cy = edgeY(i);
    const nx = points[i + 1].x;
    const ny = edgeY(i + 1);
    g.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
  }

  // The blade itself carries no gap — that is what hides the seam ahead of it
  const blade = points[n - 1];
  const frontDx = blade.x - points[n - 2].x;
  const frontSlope =
    frontDx !== 0
      ? clamp((blade.y - points[n - 2].y) / frontDx, -1.1, 1.1)
      : 0;

  g.lineTo(blade.x, blade.y);
  g.lineTo(frontX, blade.y + frontSlope * (frontX - blade.x));
  g.lineTo(frontX, cornerY);
  g.closePath();
  g.fill(0xffffff);
}

/** The part of the pack the blade has not reached yet — still one solid piece. */
function drawUncutMask(g, points, rect, dir, OVERSHOOT) {
  const n = points.length;
  const top = rect.top - OVERSHOOT;
  const height = rect.height + OVERSHOOT * 2;
  g.clear();

  if (n < 2 || dir === 0) {
    g.rect(rect.left - OVERSHOOT, top, rect.width + OVERSHOOT * 2, height);
    g.fill(0xffffff);
    return;
  }

  const bladeX = points[n - 1].x;
  const left = dir > 0 ? bladeX - 0.5 : rect.left - OVERSHOOT;
  const right = dir > 0 ? rect.right + OVERSHOOT : bladeX + 0.5;
  if (right - left <= 0) {
    return;
  }
  g.rect(left, top, right - left, height);
  g.fill(0xffffff);
}

export class PackWrapper {
  constructor(root, texture, rect) {
    this.rect = rect;
    this.uncut = new Sprite(texture);
    this.bottom = new Sprite(texture);
    this.top = new Sprite(texture);

    this.uncutMask = new Graphics();
    this.bottomMask = new Graphics();
    this.topMask = new Graphics();

    // Masks have to live in the scene graph for Pixi to render them
    root.addChild(
      this.uncutMask,
      this.bottomMask,
      this.topMask,
      this.bottom,
      this.top,
      this.uncut,
    );
    this.uncut.mask = this.uncutMask;
    this.bottom.mask = this.bottomMask;
    this.top.mask = this.topMask;

    this.layout(rect);
  }

  /** Called again whenever the pack rect changes — a resize or a rebuild. */
  layout(rect) {
    this.rect = rect;
    for (const part of [this.uncut, this.bottom, this.top]) {
      part.position.set(rect.left, rect.top);
      part.width = rect.width;
      part.height = rect.height;
    }
  }

  redraw(trail, dir, openness, interaction) {
    const {rect} = this;
    drawUncutMask(this.uncutMask, trail, rect, dir, interaction.overshoot);
    drawTearMask(this.topMask, trail, rect, dir, -1, openness, interaction);
    drawTearMask(this.bottomMask, trail, rect, dir, 1, openness, interaction);
  }

  /** Both halves home and opaque again, for a replay. */
  reset() {
    this.top.alpha = 1;
    this.bottom.alpha = 1;
    this.uncut.alpha = 1;
    this.moveHalf(this.top, this.topMask, 0, 0);
    this.moveHalf(this.bottom, this.bottomMask, 0, 0);
  }

  /**
   * Moves one half of the wrapper together with its mask. The mask paths are
   * built in world coordinates, so a sprite that moves on its own slides out
   * from under its own cut — and the half starts showing the wrong part of the
   * artwork, which reads as an uncut pack.
   */
  moveHalf(sprite, mask, dx, dy, rotation = 0) {
    const {rect} = this;
    sprite.position.set(rect.left + dx, rect.top + dy);
    sprite.rotation = rotation;
    mask.pivot.set(rect.left, rect.top);
    mask.position.set(rect.left + dx, rect.top + dy);
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
