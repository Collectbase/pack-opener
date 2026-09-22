/**
 * The card that comes out of the pack: its artwork, the blank back it spins
 * behind, the glows around it and the beam that runs its outline. It owns those
 * nodes and every phase of the reveal — a scene hands it the pack rect, the
 * options and a time, and asks it to draw.
 *
 * Shared on purpose: how the wrapper comes apart is what makes a mechanic, but
 * the card that comes out is the same object every time. A variant picks how it
 * enters: slid past a cut lip and turned over (`park` + `slide` + `reveal`), or
 * put there whole once something else has drawn its arrival (`place` +
 * `revealInstant`).
 */
import {Container, Graphics, MeshRope, Point, Sprite, Texture} from 'pixi.js';
import {clamp, easeInOut, easeOut, jitterAt, outlinePath, pointAt} from './geometry';
import {
  makeBloomTexture,
  makeCardBackTexture,
  makeCometTexture,
  makeHaloTexture,
  makeSheenTexture,
} from './textures';

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
  }

  setOptions(options, colors) {
    this.o = options;
    this.colors = colors;
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

  setTexture(texture) {
    this.texture = texture;
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
    // Wipe mask: shrinks downwards while the card is unveiled
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

    this.sparks = new Graphics();
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
      this.sparks,
      this.beam,
    );
    this.node.addChild(this.bloom, this.rim, this.halo, this.turn);

    // Hides whatever part of the card is still inside the wrapper
    this.clipG = new Graphics();
    this.sceneRoot.addChild(this.clipG);

    this.rim.baseScaleX = this.rim.scale.x;
    this.glowBase = {
      rim: {x: this.rim.scale.x, y: this.rim.scale.y},
      halo: {x: this.halo.scale.x, y: this.halo.scale.y},
    };
    this.face.alpha = 0;
    this.drawBackMask(1);
    this.fitFace();
  }

  /** Everything above `bottomY` is visible; the rest is still in the wrapper. */
  clip(bottomY) {
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

  drawSparks(edgeY, strength) {
    const {width} = this.size;
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
        .fill({color: this.colors.spark, alpha: reveal.sparkAlpha * strength});
    }
  }

  /** `progress` runs the beam around the outline, `settled` fades the rim in. */
  drawBeam(progress, settled) {
    const {width, height} = this.size;
    const path = this.beamPath;
    const color = this.colors.glow;
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
          color: this.colors.beam,
          alpha,
          cap: 'round',
        });
    }

    const tip = pointAt(path, head);
    this.beam
      .circle(tip.x - width / 2, tip.y - height / 2, reveal.beamTipRadius)
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
    const {width, height} = this.size;
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
      points[i].set(p.x - width / 2, p.y - height / 2);
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
   * looked like the card switched its light on late.
   */
  slide(t) {
    const glow = clamp(t / this.o.motion.open.cardFrom, 0, 1);
    this.bloom.alpha = glow;
    this.rim.alpha = glow * this.o.motion.reveal.rimAlpha;

    const p = clamp((t - this.o.motion.open.cardFrom) / (1 - this.o.motion.open.cardFrom), 0, 1);
    const eased = easeOut(p);
    const target = this.spinY ?? this.toY;
    this.node.y = this.fromY + (target - this.fromY) * eased;
  }

  reveal(kind, t) {
    const {height} = this.size;
    const reveal = this.o.motion.reveal;

    if (kind === 'spin' || kind === 'spinHold') {
      // Eased, so the turn picks up from the slide-out and settles into the wipe
      // instead of starting and stopping at full speed. The hold — artwork
      // still on its way — keeps turning at one steady speed instead: a whole
      // turn per hold, so it can run on for as many holds as it takes with no
      // stop between them, and end square, where the unveil picks up
      const angle =
        kind === 'spin'
          ? Math.PI * 2 * reveal.spinTurns * easeInOut(t)
          : Math.PI * 2 * t;
      const cos = Math.cos(angle);
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

    if (kind === 'unveil') {
      // Square up before the wipe so the card reads flat
      this.turn.scale.x = 1;
      this.back.tint = 0xffffff;
      // The item is not allowed on screen before this phase
      this.face.alpha = 1;

      const eased = easeInOut(t);
      // A card that turned where the pack was rises onto its stand with the wipe
      if (this.lifts) {
        this.node.y = this.spinY + (this.toY - this.spinY) * eased;
      }
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
      this.drawSparks(0, 0);
      return;
    }

    if (kind === 'hold') {
      this.drawBeam(1, 1);
      this.halo.alpha = reveal.haloAlpha;
    }
  }

  /** Puts the revealed card back inside the pack so a replay starts clean. */
  rewind(rect) {
    if (!this.node) {
      return;
    }
    this.node.alpha = 0;
    this.node.y = rect.top + rect.height / 2;
    this.node.scale.set(1);
    this.bloom.alpha = 0;
    this.rim.alpha = 0;
    this.rim.scale.set(this.glowBase.rim.x, this.glowBase.rim.y);
    this.halo.alpha = 0;
    this.halo.scale.set(this.glowBase.halo.x, this.glowBase.halo.y);
    this.sheen.visible = false;
    this.turn.scale.x = 1;
    this.back.tint = 0xffffff;
    this.sparks.clear();
    this.beam.clear();
    this.hideRibbon();
    this.face.alpha = 0;
    this.drawBackMask(1);
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
    // onto its stand during the unveil (see `reveal`)
    this.spinY =
      this.o.layout.card.spinAt === 'pack' && rect
        ? rect.top + rect.height / 2
        : this.toY;
    this.turn.mask = this.clipG;
    this.clip(cutY);
  }

  /** Whether the card still has to rise onto its stand after the spin. */
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
    // Nothing of the blank back left to wipe away
    this.drawBackMask(0);
    this.sparks.clear();
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
    this.node = null;
  }
}
