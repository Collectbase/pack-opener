/**
 * Pixi scene for the pack opening. It is the `slice` variant: the seal is cut
 * with a finger, the lid tears away and the card reveals itself.
 *
 * The scene knows nothing about where it runs. It draws, it reads the gesture
 * it is handed, and it reports what happened through `emit` — the host decides
 * whether that becomes a callback in a browser or a postMessage across a
 * WebView bridge. Everything around it lives in `core/createPackOpener`.
 */
import {Container, Graphics, Sprite, Texture} from 'pixi.js';
import {MESSAGES} from '../../config/protocol';
import {toNumber, withAlpha} from '../../runtime/color';

/* ─── plumbing ─────────────────────────────────────────────────────────── */

const clamp = (value, min, max) =>
  value < min ? min : value > max ? max : value;

/** Stable pseudo-noise keyed by point index — the ragged edge never flickers. */
const jitterAt = (index, phase) =>
  Math.sin(index * 1.73 + phase) * 0.6 +
  Math.sin(index * 4.31 + phase * 2.1) * 0.4;

const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* ─── generated textures ───────────────────────────────────────────────── */

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.ceil(w * dpr));
  canvas.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return {canvas, ctx};
}

/** `ctx.roundRect` is missing on older WebViews. */
function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Blank slab the card shows while it spins. */
function makeCardBackTexture(w, h, theme) {
  const {canvas, ctx} = makeCanvas(w, h);
  roundRectPath(ctx, 0, 0, w, h, theme.cornerRadius);
  ctx.clip();

  const back = theme.cardBack;
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, back.top);
  base.addColorStop(0.5, back.mid);
  base.addColorStop(1, back.bottom);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const sheen = ctx.createLinearGradient(0, h, w, 0);
  sheen.addColorStop(0, withAlpha(back.sheen, 0));
  sheen.addColorStop(0.5, back.sheen);
  sheen.addColorStop(1, withAlpha(back.sheen, 0));
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  return Texture.from(canvas);
}

/** Soft radial bloom — the card glows while it is still blank. */
function makeBloomTexture(size, color) {
  const {canvas, ctx} = makeCanvas(size, size);
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, withAlpha(color, 0.95));
  gradient.addColorStop(0.42, withAlpha(color, 0.3));
  gradient.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

/** Halo hugging the card silhouette, in the rarity colour. */
function makeHaloTexture(w, h, color, spread, radius) {
  const {canvas, ctx} = makeCanvas(w + spread * 2, h + spread * 2);
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    ctx.shadowBlur = spread * (0.45 + i * 0.35);
    roundRectPath(ctx, spread, spread, w, h, radius);
    ctx.fill();
  }
  return Texture.from(canvas);
}

/** Sampled outline of the card, used by the beam that runs around it. */
function outlinePath(w, h, radius, perCorner = 8) {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  const points = [];
  const corners = [
    {cx: w - r, cy: r, start: -Math.PI / 2},
    {cx: w - r, cy: h - r, start: 0},
    {cx: r, cy: h - r, start: Math.PI / 2},
    {cx: r, cy: r, start: Math.PI},
  ];
  const straights = [
    [{x: r, y: 0}, {x: w - r, y: 0}],
    [{x: w, y: r}, {x: w, y: h - r}],
    [{x: w - r, y: h}, {x: r, y: h}],
    [{x: 0, y: h - r}, {x: 0, y: r}],
  ];

  for (let side = 0; side < 4; side++) {
    points.push(straights[side][0], straights[side][1]);
    const {cx, cy, start} = corners[side];
    for (let i = 1; i < perCorner; i++) {
      const angle = start + (Math.PI / 2) * (i / perCorner);
      points.push({x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle)});
    }
  }

  const lengths = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
    lengths.push(total);
  }
  const closing = Math.hypot(
    points[0].x - points[points.length - 1].x,
    points[0].y - points[points.length - 1].y,
  );

  return {points, lengths, total: total + closing};
}

function pointAt(path, distance) {
  const {points, lengths, total} = path;
  let d = distance % total;
  if (d < 0) {
    d += total;
  }
  const lastLength = lengths[lengths.length - 1];
  if (d >= lastLength) {
    const last = points[points.length - 1];
    const first = points[0];
    const t = (d - lastLength) / (total - lastLength || 1);
    return {x: last.x + (first.x - last.x) * t, y: last.y + (first.y - last.y) * t};
  }

  let lo = 0;
  let hi = lengths.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] <= d) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const t = (d - lengths[lo]) / (lengths[hi] - lengths[lo] || 1);
  return {
    x: points[lo].x + (points[hi].x - points[lo].x) * t,
    y: points[lo].y + (points[hi].y - points[lo].y) * t,
  };
}

/* ─── geometry ─────────────────────────────────────────────────────────── */

function computePackRect(width, height, aspect, interaction, pack) {
  const maxWidth = width * pack.widthRatio;
  const maxHeight = height * pack.heightRatio;
  let w = maxWidth;
  let h = w / aspect;
  if (h > maxHeight) {
    h = maxHeight;
    w = h * aspect;
  }
  const left = (width - w) / 2;
  const top = (height - h) / 2 + height * pack.offsetY;

  return {
    left,
    top,
    right: left + w,
    bottom: top + h,
    width: w,
    height: h,
    cutTop: top + h * interaction.band.top,
    cutBottom: top + h * interaction.band.bottom,
    gap: h * interaction.gapRatio,
  };
}

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

/**
 * Mimes the swipe: a soft white comet that sweeps across the top of the pack.
 * Built from overlapping discs rather than a stroked line — the taper reads
 * smoother, and it is one fill batch. `head` is its position over the sweep.
 */
function drawHint(g, rect, head, hint, color) {
  g.clear();

  // Eased in and out at the ends of the sweep, so nothing pops into view
  const presence = Math.sin(Math.PI * clamp(head, 0, 1));
  if (presence <= 0.01) {
    return;
  }

  const y = rect.top + rect.height * hint.lineRatio;
  const span = rect.width * hint.sweep;
  const from = rect.left + (rect.width - span) / 2;
  const x = from + span * head;
  const tail = rect.width * hint.tail;

  for (let i = 0; i < hint.segments; i++) {
    // 0 at the far end of the tail, 1 at the head
    const t = (i + 1) / hint.segments;
    const px = x - tail * (1 - t);
    if (px < from) {
      continue;
    }
    g.circle(px, y, hint.headRadius * t).fill({
      color,
      alpha: hint.tailAlpha * Math.pow(t, hint.tailFalloff) * presence,
    });
  }

  g.circle(x, y, hint.headRadius).fill({color, alpha: presence});
}

/* ─── scene ────────────────────────────────────────────────────────────── */

export class PackScene {
  /**
   * `options` arrives already resolved — filling defaults in is the variant
   * registry's job, not the scene's. `emit(type, payload)` is how the scene
   * talks back: a plain callback, so the host is free to turn it into a bridge
   * message or a DOM event.
   */
  constructor(app, texture, options, emit) {
    this.app = app;
    this.texture = texture;
    this.emit = emit || (() => {});
    this.o = options;
    this.glowColor = toNumber(this.o.theme.glow);
    this.beamColor = toNumber(this.o.theme.beam);
    this.sparkColor = toNumber(this.o.theme.spark);
    this.hintColor = toNumber(this.o.theme.hint);

    this.trail = [];
    this.dir = 0;
    this.progress = 0;
    this.openness = 0;
    this.release = 0;
    this.locked = false;
    this.enabled = true;
    this.startX = 0;
    this.startY = 0;
    this.maxAdvance = 0;
    this.needAdvance = 1;
    this.lastTick = 0;
    this.dirty = true;
    // Pack fades in instead of popping: no white flash, no jump from a
    // placeholder drawn with different geometry
    this.intro = 0;
    this.hintClock = 0;
    this.hintAlpha = 1;

    this.root = new Container();
    this.root.alpha = 0;
    app.stage.addChild(this.root);

    const aspect = texture.width / texture.height;
    this.rect = computePackRect(
      app.screen.width,
      app.screen.height,
      aspect,
      this.o.interaction,
      this.o.layout.pack,
    );

    this.uncut = new Sprite(texture);
    this.bottom = new Sprite(texture);
    this.top = new Sprite(texture);

    this.uncutMask = new Graphics();
    this.bottomMask = new Graphics();
    this.topMask = new Graphics();

    for (const part of [this.uncut, this.bottom, this.top]) {
      part.position.set(this.rect.left, this.rect.top);
      part.width = this.rect.width;
      part.height = this.rect.height;
    }

    // Above the artwork — the hint has to stay readable over it
    this.hint = new Graphics();

    // Masks have to live in the scene graph for Pixi to render them
    this.root.addChild(
      this.uncutMask,
      this.bottomMask,
      this.topMask,
      this.bottom,
      this.top,
      this.uncut,
      this.hint,
    );
    this.uncut.mask = this.uncutMask;
    this.bottom.mask = this.bottomMask;
    this.top.mask = this.topMask;

    this.redraw();
  }

  get points() {
    return this.trail;
  }

  /**
   * Drives the engine's frame cap. `dirty` counts as busy: the masks are one
   * redraw behind, and dropping to a sleeping frame rate before that lands
   * would leave the pack half-cut on screen.
   */
  get activity() {
    if (this.anim || this.dirty || this.intro < 1) {
      return 'busy';
    }
    return this.hintAlpha > 0 ? 'hint' : 'idle';
  }

  redraw() {
    const {trail, rect, dir, openness} = this;
    const interaction = this.o.interaction;
    drawUncutMask(this.uncutMask, trail, rect, dir, interaction.overshoot);
    drawTearMask(this.topMask, trail, rect, dir, -1, openness, interaction);
    drawTearMask(this.bottomMask, trail, rect, dir, 1, openness, interaction);
    this.dirty = false;
  }

  /* ── gesture ── */

  onDown(x, y) {
    if (!this.enabled || this.locked) {
      this.ignoring = true;
      return;
    }
    const {rect} = this;
    const inside =
      x >= rect.left - 16 &&
      x <= rect.right + 16 &&
      y >= rect.top - 16 &&
      y <= rect.bottom + 16;
    this.ignoring = !inside;
    if (this.ignoring) {
      return;
    }
    this.startX = x;
    this.startY = clamp(y, rect.cutTop, rect.cutBottom);
    this.started = false;
  }

  onMove(x, y) {
    if (this.ignoring || this.locked) {
      return;
    }
    const {rect} = this;

    if (!this.started) {
      if (Math.abs(x - this.startX) < this.o.interaction.activation) {
        return;
      }
      this.started = true;
      this.dir = x >= this.startX ? 1 : -1;
      this.trail = [{x: this.startX, y: this.startY}];
      this.bladeX = this.startX;
      this.bladeY = this.startY;

      // Starting near an edge leaves less room, so ask for less travel
      const reach =
        this.dir > 0 ? rect.right - this.startX : this.startX - rect.left;
      this.needAdvance = Math.max(
        Math.min(rect.width * this.o.interaction.completeFraction, reach * 0.85),
        rect.width * 0.28,
      );
      this.emit(MESSAGES.INTERACTION_START);
    }

    const px = clamp(x, rect.left - 12, rect.right + 12);
    const py = clamp(y, rect.cutTop, rect.cutBottom);

    // A cut cannot be un-cut: the blade only ever moves forward
    if ((px - this.bladeX) * this.dir <= 0) {
      return;
    }
    const last = this.trail[this.trail.length - 1];
    if (
      this.trail.length < this.o.interaction.trailMaxPoints &&
      (px - last.x) * this.dir >= this.o.interaction.trailStep
    ) {
      this.trail.push({x: px, y: py});
    }
    this.bladeX = px;
    this.bladeY = py;

    this.maxAdvance = Math.max(
      this.maxAdvance,
      (px - this.startX) * this.dir,
    );
    this.progress = clamp(this.maxAdvance / this.needAdvance, 0, 1);
    this.openness = this.progress;
    this.dirty = true;

    if (this.progress - this.lastTick >= this.o.interaction.tickStep) {
      this.lastTick = this.progress;
      this.emit(MESSAGES.TICK, {progress: this.progress});
    }

    if (this.progress >= 1) {
      this.commit();
    }
  }

  onUp() {
    if (this.ignoring || this.locked) {
      return;
    }
    if (this.progress > 0) {
      this.retract();
    }
  }

  /* ── phases ── */

  commit() {
    if (this.locked) {
      return;
    }
    this.locked = true;
    this.progress = 1;
    this.emit(MESSAGES.COMMITTED);
    // The blade runs out to the pack edge, then the lid tears away
    this.animate('runOut', this.o.motion.finishMs, () => this.openLid());
  }

  openLid() {
    this.prepareCard();
    this.openedPosted = false;
    this.animate('open', this.o.motion.open.ms, () =>
      this.animate('spin', this.o.motion.reveal.spinMs, () => this.startUnveil()),
    );
  }

  /* ── card reveal (replaces the old open_pack_video) ── */

  setCardTexture(texture) {
    this.cardTexture = texture;
    if (this.face && texture) {
      this.face.texture = texture;
      this.fitFace();
    }
  }

  /** Cover-fits the artwork into the card frame. */
  fitFace() {
    const texture = this.face?.texture;
    if (!texture || !texture.width) {
      return;
    }
    const {width, height} = this.cardRect;
    const scale = Math.max(width / texture.width, height / texture.height);
    this.face.width = texture.width * scale;
    this.face.height = texture.height * scale;
    this.face.position.set(0, 0);
  }

  buildCard() {
    const {rect} = this;
    const aspect = this.cardTexture
      ? this.cardTexture.width / this.cardTexture.height
      : this.o.layout.card.aspect;
    const ratio = Math.min(aspect, this.o.layout.card.maxRatio);

    // Capping the width has to shrink the height too, or the card comes out
    // stretched and the artwork gets cropped
    let height = rect.height * this.o.layout.card.heightRatio;
    let width = height * ratio;
    const maxWidth = rect.width * this.o.layout.card.packWidthRatio;
    if (width > maxWidth) {
      width = maxWidth;
      height = width / ratio;
    }
    this.cardRect = {width, height};

    this.cardRoot = new Container();
    this.cardRoot.position.set(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    this.cardRoot.alpha = 0;
    // Below the wrapper so the card looks like it slides out from inside
    this.root.addChildAt(this.cardRoot, 0);

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
    this.cardTurn = new Container();

    this.face = new Sprite(this.cardTexture || Texture.WHITE);
    this.face.anchor.set(0.5);
    const faceMask = new Graphics()
      .roundRect(-width / 2, -height / 2, width, height, this.o.theme.cornerRadius)
      .fill(0xffffff);
    this.face.mask = faceMask;

    this.back = new Sprite(makeCardBackTexture(width, height, this.o.theme));
    this.back.anchor.set(0.5);
    this.back.width = width;
    this.back.height = height;
    // Wipe mask: shrinks downwards while the card is unveiled
    this.backMask = new Graphics();
    this.back.mask = this.backMask;

    this.sparks = new Graphics();
    this.beam = new Graphics();
    this.beamPath = outlinePath(
      width,
      height,
      this.o.theme.cornerRadius,
      this.o.motion.reveal.outlineDetail,
    );

    this.cardTurn.addChild(
      this.face,
      faceMask,
      this.back,
      this.backMask,
      this.sparks,
      this.beam,
    );
    this.cardRoot.addChild(this.bloom, this.rim, this.halo, this.cardTurn);

    // Hides whatever part of the card is still inside the wrapper
    this.cardClip = new Graphics();
    this.root.addChild(this.cardClip);

    this.rim.baseScaleX = this.rim.scale.x;
    this.face.alpha = 0;
    this.drawBackMask(1);
    this.fitFace();
  }

  /** Everything above `bottomY` is visible; the rest is still in the wrapper. */
  drawCardClip(bottomY) {
    const {width, height} = this.app.screen;
    this.cardClip
      .clear()
      .rect(-width, -height, width * 3, height + bottomY)
      .fill(0xffffff);
  }

  /** `visible` is the share of the back still covering the card, top-down. */
  drawBackMask(visible) {
    const {width, height} = this.cardRect;
    const covered = height * visible;
    this.backMask.clear();
    if (covered <= 0) {
      return;
    }
    this.backMask
      .rect(-width / 2 - 4, height / 2 - covered, width + 8, covered)
      .fill(0xffffff);
  }

  drawSparks(edgeY, strength) {
    const {width} = this.cardRect;
    this.sparks.clear();
    if (strength <= 0) {
      return;
    }
    const reveal = this.o.motion.reveal;
    for (let i = 0; i < reveal.sparks; i++) {
      const t = (i + 0.5) / reveal.sparks;
      const wobble = jitterAt(i, 0);
      const x = -width / 2 + width * t + wobble * reveal.sparkSpreadX;
      const y = edgeY + wobble * reveal.sparkSpreadY;
      const size =
        (reveal.sparkSize + Math.abs(wobble) * reveal.sparkJitter) * strength;
      this.sparks
        .circle(x, y, size)
        .fill({color: this.sparkColor, alpha: reveal.sparkAlpha * strength});
    }
  }

  /** `progress` runs the beam around the outline, `settled` fades the rim in. */
  drawBeam(progress, settled) {
    const {width, height} = this.cardRect;
    const path = this.beamPath;
    const color = this.glowColor;
    const reveal = this.o.motion.reveal;

    this.beam.clear();

    if (settled > 0) {
      this.beam
        .roundRect(-width / 2, -height / 2, width, height, this.o.theme.cornerRadius)
        .stroke({
          width: reveal.beamWidth,
          color,
          alpha: reveal.beamAlpha * settled,
        });
    }
    if (progress <= 0 || progress >= 1) {
      return;
    }

    const head = progress * path.total;
    const tail = path.total * reveal.beamTail;
    const steps = reveal.beamSteps;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const p0 = pointAt(path, head - tail * (1 - t0));
      const p1 = pointAt(path, head - tail * (1 - t1));
      const alpha = t1 * t1;
      this.beam
        .moveTo(p0.x - width / 2, p0.y - height / 2)
        .lineTo(p1.x - width / 2, p1.y - height / 2)
        .stroke({
          width: reveal.beamGlowWidth,
          color,
          alpha: alpha * reveal.beamGlowAlpha,
          cap: 'round',
        })
        .moveTo(p0.x - width / 2, p0.y - height / 2)
        .lineTo(p1.x - width / 2, p1.y - height / 2)
        .stroke({
          width: reveal.beamWidth,
          color: this.beamColor,
          alpha,
          cap: 'round',
        });
    }

    const tip = pointAt(path, head);
    this.beam
      .circle(tip.x - width / 2, tip.y - height / 2, reveal.beamTipRadius)
      .fill({color: this.beamColor, alpha: reveal.beamAlpha});
  }

  /** Everything the slide-out needs, resolved before the timeline starts. */
  prepareCard() {
    // Built once — a replay reuses the same card and just rewinds it
    if (!this.cardRoot) {
      this.buildCard();
    }

    // Height of the cut, averaged over the trail — the lip the card slides past
    const trail = this.trail;
    this.cutY = trail.length
      ? trail.reduce((sum, point) => sum + point.y, 0) / trail.length
      : this.rect.top + this.rect.height * this.o.interaction.band.top;

    // Parked just below the lip, so the card starts out of sight inside the
    // wrapper and the clip alone decides how much of it shows
    this.cardFromY = this.cutY + this.cardRect.height / 2;
    this.cardRoot.y = this.cardFromY;
    this.cardRoot.alpha = 1;
    this.cardToY = this.app.screen.height / 2;
    this.cardTurn.mask = this.cardClip;
    this.drawCardClip(this.cutY);
  }

  /** The artwork may still be downloading — wait for it, but not forever. */
  startUnveil() {
    if (!this.cardTexture && !this.artWaitStart) {
      this.artWaitStart = Date.now();
    }
    const waited = this.artWaitStart ? Date.now() - this.artWaitStart : 0;
    if (!this.cardTexture && waited < this.o.assets.card.timeoutMs) {
      this.animate('spin', this.o.motion.reveal.artWaitSpinMs, () =>
        this.startUnveil(),
      );
      return;
    }

    this.animate('unveil', this.o.motion.reveal.unveilMs, () =>
      this.animate('beam', this.o.motion.reveal.beamMs, () =>
        this.animate('hold', this.o.motion.reveal.holdMs, () =>
          this.emit(MESSAGES.REVEALED, {card: this.cardBounds()}),
        ),
      ),
    );
  }

  /** Where the card came to rest, so React Native can build its UI around it. */
  cardBounds() {
    const {width, height} = this.cardRect;
    const x = this.cardRoot.x;
    return {
      left: x - width / 2,
      right: x + width / 2,
      top: this.cardToY - height / 2,
      bottom: this.cardToY + height / 2,
      width,
      height,
    };
  }

  /**
   * The card and its glow. `t` is the whole open timeline: the glow leads, so by
   * the time the card clears the lip it is already lit — catching up afterwards
   * looked like the card switched its light on late.
   */
  updateCard(t) {
    const glow = clamp(t / this.o.motion.open.cardFrom, 0, 1);
    this.bloom.alpha = glow;
    this.rim.alpha = glow * this.o.motion.reveal.rimAlpha;

    const p = clamp((t - this.o.motion.open.cardFrom) / (1 - this.o.motion.open.cardFrom), 0, 1);
    const eased = easeOut(p);
    this.cardRoot.y = this.cardFromY + (this.cardToY - this.cardFromY) * eased;
  }

  updateReveal(kind, t) {
    const {height} = this.cardRect;
    const reveal = this.o.motion.reveal;

    if (kind === 'spin') {
      // Eased, so the turn picks up from the slide-out and settles into the wipe
      // instead of starting and stopping at full speed
      const angle = Math.PI * 2 * reveal.spinTurns * easeInOut(t);
      const cos = Math.cos(angle);
      const flat = Math.max(Math.abs(cos), reveal.spinFlatness);
      // Scale alone reads as a turn; skewing on top of it looks like the card
      // is bent rather than rotating
      this.cardTurn.scale.x = flat;
      const shade = 1 - reveal.spinShade + reveal.spinShade * Math.abs(cos);
      const tint = Math.round(255 * shade);
      this.back.tint = (tint << 16) | (tint << 8) | tint;
      this.bloom.alpha =
        reveal.spinBloom + (1 - reveal.spinBloom) * Math.abs(cos);
      this.rim.alpha = reveal.rimAlpha;
      this.rim.scale.x = this.rim.baseScaleX * flat;
      return;
    }

    if (kind === 'unveil') {
      // Square up before the wipe so the card reads flat
      this.cardTurn.scale.x = 1;
      this.back.tint = 0xffffff;
      // The item is not allowed on screen before this phase
      this.face.alpha = 1;

      const eased = easeInOut(t);
      this.drawBackMask(1 - eased);
      // Sparks ride the wipe edge, which is the top of what the back still
      // covers: `height / 2 - covered`. Measuring them from the opposite edge
      // sent them up while the wipe went down.
      this.drawSparks(-height / 2 + height * eased, Math.sin(Math.PI * t));
      this.bloom.alpha = reveal.bloomAlpha * (1 - eased);
      this.rim.alpha = reveal.rimAlpha * (1 - eased);
      this.rim.scale.x = this.rim.baseScaleX;
      return;
    }

    if (kind === 'beam') {
      const eased = easeInOut(t);
      this.drawSparks(0, 0);
      this.drawBeam(eased, eased);
      this.halo.alpha = eased * reveal.haloAlpha;
      return;
    }

    if (kind === 'hold') {
      this.drawBeam(1, 1);
      this.halo.alpha = reveal.haloAlpha;
    }
  }

  retract() {
    this.animate('retract', this.o.motion.retractMs, () => {
      this.trail = [];
      this.dir = 0;
      this.progress = 0;
      this.openness = 0;
      this.maxAdvance = 0;
      this.lastTick = 0;
      this.started = false;
      this.dirty = true;
      this.emit(MESSAGES.RETRACTED);
    });
  }

  /** Point on the synthetic slice arc used by the tap-to-open fallback. */
  arcPoint(t) {
    const {rect} = this;
    const arc = this.o.interaction.autoArc;
    const x0 = rect.left + rect.width * arc.inset;
    const x1 = rect.right - rect.width * arc.inset;
    const y0 = rect.top + rect.height * arc.fromY;
    const y1 = rect.top + rect.height * arc.toY;
    const cx = (x0 + x1) / 2;
    const cy = rect.top + rect.height * arc.controlY;
    const mt = 1 - t;

    return {
      x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
      y: mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
    };
  }

  autoSlice() {
    if (this.locked) {
      return;
    }
    this.locked = true;
    this.dir = 1;
    const start = this.arcPoint(0);
    this.trail = [start];
    this.bladeX = start.x;
    this.bladeY = start.y;
    this.emit(MESSAGES.INTERACTION_START);
    this.animate('autoSlice', this.o.motion.autoSliceMs, () => this.openLid());
  }

  setEnabled(value) {
    this.enabled = !!value;
  }

  /**
   * Only the scene graph — the renderer belongs to the host, which tears it
   * down itself. Keeps the variant safe to swap out without dropping the app.
   */
  destroy() {
    this.root.destroy({children: true});
  }

  /**
   * Applies new options to a live scene. Numbers and colours land immediately —
   * the scene reads them where it uses them — but anything baked into a texture
   * or into the pack rect waits for the next `reset()`: rebuilding the card
   * mid-ceremony would strip the masks off the trail and blank the revealed art.
   */
  setOptions(next) {
    const before = this.o;
    this.o = next;
    this.glowColor = toNumber(next.theme.glow);
    this.beamColor = toNumber(next.theme.beam);
    this.sparkColor = toNumber(next.theme.spark);
    this.hintColor = toNumber(next.theme.hint);
    this.dirty = true;

    const baked =
      JSON.stringify(before.theme) !== JSON.stringify(next.theme) ||
      JSON.stringify(before.layout) !== JSON.stringify(next.layout) ||
      JSON.stringify(before.interaction.band) !==
        JSON.stringify(next.interaction.band);

    if (!baked) {
      this.redraw();
      return;
    }
    if (this.anim || this.started) {
      this.pendingRebuild = true;
      return;
    }
    this.rebuild();
  }

  /** Re-derives the pack rect and the card, which bake options into textures. */
  rebuild() {
    this.pendingRebuild = false;
    this.rect = computePackRect(
      this.app.screen.width,
      this.app.screen.height,
      this.texture.width / this.texture.height,
      this.o.interaction,
      this.o.layout.pack,
    );
    for (const part of [this.uncut, this.bottom, this.top]) {
      part.position.set(this.rect.left, this.rect.top);
      part.width = this.rect.width;
      part.height = this.rect.height;
    }
    if (this.cardRoot) {
      this.cardRoot.destroy({children: true});
      this.cardRoot = null;
      this.buildCard();
      this.rewindCard();
    }
    this.dirty = true;
    this.redraw();
  }

  reset() {
    if (this.pendingRebuild) {
      this.rebuild();
    }
    this.anim = null;
    this.trail = [];
    this.dir = 0;
    this.progress = 0;
    this.openness = 0;
    this.release = 0;
    this.maxAdvance = 0;
    this.lastTick = 0;
    this.locked = false;
    this.started = false;
    this.ignoring = false;
    this.openedPosted = false;
    this.top.alpha = 1;
    this.bottom.alpha = 1;
    this.uncut.alpha = 1;
    this.moveHalf(this.top, this.topMask, 0, 0);
    this.moveHalf(this.bottom, this.bottomMask, 0, 0);
    this.rewindCard();
    this.dirty = true;
    this.redraw();
  }

  /** Puts the revealed card back inside the pack so a replay starts clean. */
  rewindCard() {
    if (!this.cardRoot) {
      return;
    }
    this.cardRoot.alpha = 0;
    this.cardRoot.y = this.rect.top + this.rect.height / 2;
    this.bloom.alpha = 0;
    this.rim.alpha = 0;
    this.rim.scale.x = this.rim.baseScaleX;
    this.halo.alpha = 0;
    this.cardTurn.scale.x = 1;
    this.back.tint = 0xffffff;
    this.sparks.clear();
    this.beam.clear();
    this.face.alpha = 0;
    this.drawBackMask(1);
    this.artWaitStart = 0;
  }

  animate(kind, duration, onDone) {
    this.anim = {kind, duration, elapsed: 0, onDone};
    if (kind === 'runOut') {
      const n = this.trail.length;
      const last = this.trail[n - 1] ?? {x: this.bladeX, y: this.bladeY};
      const prev = this.trail[Math.max(0, n - 2)] ?? last;
      const dx = last.x - prev.x;
      this.runOutFrom = {
        x: this.bladeX,
        y: this.bladeY,
        slope:
          dx !== 0
            ? clamp(
                (last.y - prev.y) / dx,
                -this.o.interaction.finishSlopeLimit,
                this.o.interaction.finishSlopeLimit,
              )
            : 0,
        targetX:
          this.dir > 0
            ? this.rect.right +
              this.rect.width * this.o.interaction.finishOvershoot
            : this.rect.left -
              this.rect.width * this.o.interaction.finishOvershoot,
      };
    }
    if (kind === 'retract') {
      this.retractFrom = this.openness;
    }
  }

  appendPoint(x, y) {
    const last = this.trail[this.trail.length - 1];
    if (
      this.trail.length < this.o.interaction.trailMaxPoints &&
      last &&
      (x - last.x) * this.dir >= this.o.interaction.trailStep
    ) {
      this.trail.push({x, y});
    }
    this.bladeX = x;
    this.bladeY = y;
  }

  update(deltaMS) {
    this.updateIntro(deltaMS);
    this.updateHint(deltaMS);

    const anim = this.anim;
    if (anim) {
      anim.elapsed += deltaMS;
      const t = clamp(anim.elapsed / anim.duration, 0, 1);

      if (anim.kind === 'runOut') {
        const from = this.runOutFrom;
        const eased = 1 - (1 - t) * (1 - t);
        const x = from.x + (from.targetX - from.x) * eased;
        const y = clamp(
          from.y + from.slope * (x - from.x),
          this.rect.cutTop,
          this.rect.cutBottom,
        );
        this.appendPoint(x, y);
        this.openness = 1;
        this.dirty = true;
      } else if (anim.kind === 'autoSlice') {
        const point = this.arcPoint(t);
        this.appendPoint(point.x, point.y);
        this.progress = t;
        this.openness = t;
        this.dirty = true;
        if (t - this.lastTick >= this.o.interaction.tickStep) {
          this.lastTick = t;
          this.emit(MESSAGES.TICK, {progress: t});
        }
      } else if (anim.kind === 'open') {
        // Masks are frozen from here on — only transforms move
        const lid = clamp(t / this.o.motion.open.lid, 0, 1);
        this.release = easeOut(lid);
        this.applyLid();
        this.applyWrapperSink(t);
        this.updateCard(t);
        if (!this.openedPosted && lid >= 1) {
          this.openedPosted = true;
          this.emit(MESSAGES.OPENED);
        }
      } else if (anim.kind === 'retract') {
        this.openness = this.retractFrom * (1 - t);
        this.dirty = true;
      } else {
        // Card reveal phases draw their own layers, the wrapper masks are done
        this.updateReveal(anim.kind, t);
      }

      if (t >= 1) {
        this.anim = null;
        anim.onDone?.();
      }
    }

    if (this.dirty) {
      this.redraw();
    }
  }

  updateIntro(deltaMS) {
    if (this.intro >= 1) {
      return;
    }
    this.intro = clamp(this.intro + deltaMS / this.o.motion.introMs, 0, 1);
    this.root.alpha = easeOut(this.intro);
  }

  /** Runs the hint loop while the pack is untouched, fades it out on contact. */
  updateHint(deltaMS) {
    const wanted = this.started || this.locked ? 0 : 1;
    if (this.hintAlpha !== wanted) {
      const step = deltaMS / this.o.hint.fadeMs;
      this.hintAlpha = clamp(
        wanted > this.hintAlpha
          ? this.hintAlpha + step
          : this.hintAlpha - step,
        0,
        1,
      );
    }

    this.hint.alpha = this.hintAlpha;
    if (this.hintAlpha <= 0) {
      return;
    }

    const cycle = this.o.hint.loopMs + this.o.hint.idleMs;
    this.hintClock = (this.hintClock + deltaMS) % cycle;
    const sweep = clamp(this.hintClock / this.o.hint.loopMs, 0, 1);
    drawHint(this.hint, this.rect, easeInOut(sweep), this.o.hint, this.hintColor);
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
  applyLid() {
    const {rect, release, dir} = this;
    const open = this.o.motion.open;
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
   * The emptied wrapper: how far it has sunk, how far it has faded, and the clip
   * that hides whatever part of the card is still behind its lip. All three live
   * here on purpose — split across two methods they disagreed for a frame and
   * the wrapper visibly jumped.
   */
  applyWrapperSink(t) {
    const {rect} = this;
    const eased = easeOut(t);
    const drop = rect.height * this.o.motion.open.sink * eased;
    this.moveHalf(this.bottom, this.bottomMask, 0, drop);

    // Sinking and fading are one motion, not one after the other
    const gone = clamp(t / this.o.motion.open.gone, 0, 1);
    this.bottom.alpha = 1 - gone;
    // The uncut copy has no business being visible past the tear
    this.uncut.alpha = 1 - clamp(t / this.o.motion.open.uncutFade, 0, 1);

    const lip = this.cutY + drop;
    const freed = clamp(
      (t - this.o.motion.open.clipFrom) / (this.o.motion.open.gone - this.o.motion.open.clipFrom),
      0,
      1,
    );
    this.drawCardClip(
      lip + (this.app.screen.height + this.cardRect.height - lip) * freed,
    );
  }
}

