/**
 * A card's price as it is first told: large — about as wide as its card —
 * over the card's top edge, there at once as the card lands and counted up
 * to what the card is worth in the time it takes to notice it, in the host's
 * own format. Then it stands still, and stars twinkle at its sides. Once
 * every card is up it leaves its card and flies into the place where the
 * host writes the total (`fly`); what stays under the card is the small price
 * (`priceLabel.js`).
 *
 * Heavy, cream at its head and gold at its foot, with a dark rim and a hard
 * shadow under it, so it reads over any artwork and any stage without a
 * panel behind it. It stands still when the stage is shaken, and its clock
 * is the wall clock: a ceremony that is hurried brings it sooner, not faster.
 */
import {CanvasTextMetrics, Container, FillGradient, Sprite, Text, TextStyle} from 'pixi.js';
import {clamp} from '../shared/geometry';
import {FONT} from './font';
import {formatPrice} from './priceLabel';
import {APPEAR_MS, COUNT_MS, SPARK, appearAt, countAt, flightAt, sparkAt} from './priceMotion';

/** The figure's height against its card's width, and the least and most it may be, in css px. */
const SIZE = 0.34;
const MIN_PX = 15;
const MAX_PX = 42;
/** The most of its card's width it takes: a long one gets smaller instead. */
const WIDE = 1.12;
/** How far above its card's top edge its middle stands, in figure heights: most of it over the edge, its foot on the card. */
const ABOVE = 0.14;
/** Its colours: the head and the foot of the figure, the rim round it and the shadow under it. */
const HEAD = 0xfff7df;
const FOOT = 0xf3c25e;
const RIM = 0x33200a;
const SHADE = 0x1a0f02;
/** A star at its side: its size against the figure's height, and how far out and up or down it may stand, in figure heights. */
const STAR = {size: 0.95, out: 0.3, spread: 0.55};
/**
 * The least time between two figures written on the way up, in ms of the
 * wall clock: each is a rimmed, shadowed text drawn on a canvas and sent to
 * the GPU, so no more than thirty a second. The last is always written, exact.
 */
const WRITE_MS = 1000 / 30;

/** Cream to gold down the figure; the cream alone where this Pixi has no such fill. */
function goldFill() {
  try {
    return new FillGradient({
      type: 'linear',
      start: {x: 0, y: 0},
      end: {x: 0, y: 1},
      colorStops: [
        {offset: 0.15, color: HEAD},
        {offset: 0.9, color: FOOT},
      ],
      textureSpace: 'local',
    });
  } catch {
    return HEAD;
  }
}

const shadowOf = size => ({color: SHADE, alpha: 0.9, blur: Math.max(1, size * 0.06), distance: Math.max(1.5, size * 0.1), angle: Math.PI / 2});
const rimOf = size => ({color: RIM, width: Math.max(2, size * 0.16), join: 'round'});

export class PricePop {
  /** `star` is the texture its stars are drawn from: the scene's, one for every price. */
  constructor(parent, font = FONT, star = null) {
    this.node = new Container();
    this.node.visible = false;
    parent.addChild(this.node);
    this.font = font || FONT;
    this.style = new TextStyle({
      fontFamily: this.font,
      fontSize: 24,
      fontWeight: '900',
      fill: goldFill(),
      stroke: rimOf(24),
      dropShadow: shadowOf(24),
      padding: 14,
    });
    this.text = new Text({text: '', style: this.style});
    this.text.anchor.set(0.5);
    this.node.addChild(this.text);
    // The stars at its sides, left then right: each `{sprite, side, up, turn}`, placed anew for every price
    this.stars = [];
    if (star) {
      for (let i = 0; i < SPARK.perSide * 2; i++) {
        const sprite = new Sprite(star);
        sprite.anchor.set(0.5);
        sprite.tint = HEAD;
        sprite.blendMode = 'add';
        sprite.visible = false;
        this.node.addChild(sprite);
        this.stars.push({sprite, side: i < SPARK.perSide ? -1 : 1, x: 0, y: 0, size: 1});
      }
    }
    this.price = null;
    this.format = null;
    // ms of the wall clock since it appeared
    this.elapsed = 0;
    this.written = '';
    this.wroteAt = -Infinity;
    // Where it stands over its card, its height, the width it may take and how far it shrinks to keep to it
    this.home = {x: 0, y: 0};
    this.size = 24;
    this.room = Infinity;
    this.fit = 1;
    // Its flight into the total: where from and to, how long, how long it still waits, how far it has got
    this.flight = null;
  }

  /** On the stage: just appeared, counting, standing or in flight. */
  get showing() {
    return this.node.visible;
  }

  /** Nothing left to count: no price, or the count is over. */
  get counted() {
    return this.price === null || this.elapsed >= COUNT_MS;
  }

  /** When everything of its own is over but the standing: appeared, counted, its stars out. */
  get stillFrom() {
    return Math.max(APPEAR_MS, COUNT_MS + (this.stars.length ? SPARK.delayMs + SPARK.gapMs * (SPARK.perSide - 1) + SPARK.lifeMs : 0));
  }

  /** The family it is set in, as CSS names it. */
  setFont(font) {
    const family = font || FONT;
    if (family === this.font) return;
    this.font = family;
    this.style.fontFamily = family;
    this.refit();
  }

  /** There at once, counting up to `price`; a price that is not a number shows nothing. */
  start(price, format) {
    this.price = typeof price === 'number' && Number.isFinite(price) ? price : null;
    this.format = format;
    this.elapsed = 0;
    this.written = '';
    this.wroteAt = -Infinity;
    this.flight = null;
    if (this.price === null) {
      this.node.visible = false;
      return;
    }
    this.node.visible = true;
    this.refit();
    this.scatterStars();
    this.draw();
  }

  /** Over the top edge of the card whose box on the stage is `card`, sized to it. */
  place(card) {
    const size = clamp(card.width * SIZE, MIN_PX, MAX_PX);
    if (Math.abs(size - this.style.fontSize) > 0.25) {
      this.style.fontSize = size;
      this.style.stroke = rimOf(size);
      this.style.dropShadow = shadowOf(size);
      this.style.padding = Math.ceil(size * 0.55);
    }
    this.size = size;
    this.home = {x: card.left + card.width / 2, y: card.top - size * ABOVE};
    this.room = card.width * WIDE;
    this.refit();
    // One in flight keeps to its course, from where it stands now
    if (this.flight) this.flight.from = {x: this.home.x, y: this.home.y};
    if (this.node.visible && !this.flight) {
      this.scatterStars();
      this.draw();
    }
  }

  /** Smaller when it is wider than the room it has. */
  refit() {
    if (this.price === null) {
      this.fit = 1;
      return;
    }
    this.full = CanvasTextMetrics.measureText(formatPrice(this.price, this.format), this.style).width;
    this.fit = this.full > this.room ? this.room / this.full : 1;
  }

  /** Its stars to new places at its two ends, a little out, each at a height and a size of its own. */
  scatterStars() {
    const half = ((this.full ?? 0) * this.fit) / 2;
    this.stars.forEach((star, i) => {
      const k = i % SPARK.perSide;
      star.x = star.side * (half + this.size * STAR.out * (0.5 + Math.random()));
      star.y = ((k - (SPARK.perSide - 1) / 2) / SPARK.perSide + (Math.random() - 0.5) * 0.25) * 2 * this.size * STAR.spread;
      star.size = (this.size * STAR.size * (0.6 + 0.6 * Math.random())) / star.sprite.texture.width;
      star.sprite.position.set(star.x, star.y);
      star.sprite.visible = false;
    });
  }

  /** Leaves its card for `to` after `delayMs`, over `durationMs` — its figure whole and its stars out from here on. Nothing for one not on show. */
  fly(to, durationMs, delayMs = 0) {
    if (!this.node.visible || this.flight) return;
    this.elapsed = Math.max(this.elapsed, this.stillFrom);
    this.draw();
    this.flight = {from: {x: this.home.x, y: this.home.y}, to: {x: to.x, y: to.y}, wait: Math.max(0, delayMs), elapsed: 0, duration: Math.max(1, durationMs)};
  }

  /** `wallMS` of the wall clock on. */
  update(wallMS) {
    if (!this.node.visible) return;
    if (this.flight) {
      this.fliesOn(wallMS);
      return;
    }
    if (this.elapsed >= this.stillFrom) return;
    this.elapsed += wallMS;
    this.draw();
  }

  fliesOn(wallMS) {
    const flight = this.flight;
    if (flight.wait > 0) {
      flight.wait -= wallMS;
      if (flight.wait > 0) return;
      flight.elapsed = -flight.wait;
    } else {
      flight.elapsed += wallMS;
    }
    const t = clamp(flight.elapsed / flight.duration, 0, 1);
    const {along, scale, alpha} = flightAt(t);
    this.node.position.set(flight.from.x + (flight.to.x - flight.from.x) * along, flight.from.y + (flight.to.y - flight.from.y) * along);
    this.node.scale.set(this.fit * scale);
    this.node.alpha = alpha;
    if (t >= 1) this.hide();
  }

  /** The figure as far up as its count has it, written no more often than `WRITE_MS`; the last always. */
  write() {
    const share = countAt(this.elapsed);
    const now = performance.now();
    if (share < 1 && now - this.wroteAt < WRITE_MS) return;
    const text = formatPrice(this.price * share, this.format);
    if (text === this.written) return;
    this.text.text = text;
    this.written = text;
    this.wroteAt = now;
  }

  /** Where its appearing, its count and its stars have got it. */
  draw() {
    if (this.price === null) return;
    this.write();
    const {alpha, scale, drop} = appearAt(this.elapsed);
    this.node.alpha = alpha;
    this.node.scale.set(this.fit * scale);
    this.node.position.set(this.home.x, this.home.y + drop * this.size);
    const since = this.elapsed - COUNT_MS - SPARK.delayMs;
    this.stars.forEach((star, i) => {
      const twinkle = sparkAt(since - (i % SPARK.perSide) * SPARK.gapMs);
      star.sprite.visible = twinkle.alpha > 0;
      if (!star.sprite.visible) return;
      star.sprite.alpha = twinkle.alpha;
      star.sprite.scale.set(star.size * twinkle.scale);
    });
  }

  /** Off the stage: flown, skipped past, or its card gone. */
  hide() {
    this.price = null;
    this.flight = null;
    this.elapsed = 0;
    this.node.visible = false;
    this.node.alpha = 1;
    for (const star of this.stars) star.sprite.visible = false;
  }

  destroy() {
    // The stars' texture is the scene's
    this.node.destroy({children: true});
  }
}
