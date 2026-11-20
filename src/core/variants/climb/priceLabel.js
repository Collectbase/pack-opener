/**
 * What is written under a turned card: its tier in the tier's light — or
 * `SOLD` once it is sold — as the card lands, and under that, once the large
 * prices have left their cards for the total (`pricePop.js`), the card's
 * price, small, in the host's own format — `prefix`, the number to `decimals`
 * places, `suffix`; the host's currency is not always an ISO one. The tier
 * stands nearest the card, so the row below has room for its own cards'
 * prices to pop over their top edges. White with a soft shadow, so it reads
 * on any stage without a panel behind it, and set in the host's family
 * (`climb.font`). It stands still when the stage is shaken: the card slides
 * over it, and it stays readable.
 */
import {CanvasTextMetrics, Container, Text, TextStyle} from 'pixi.js';
import {mixNumbers, toNumber} from '../../runtime/color';
import {clamp, easeOut} from '../shared/geometry';
import {FONT} from './font';

/**
 * The room the grid keeps under every card for what is written there, in
 * card widths: the tier's line, the figure and the space above them — and,
 * for a card so small that both lines are at their least, never less than
 * those two lines take, in css px.
 */
export const LABEL_ROOM = 0.4;
export const LABEL_MIN_PX = 30;
/** The figure's height against its card's width, and the least and most it may be, in css px. */
const SIZE = 0.17;
const MIN_PX = 11;
const MAX_PX = 30;
/** The tier's line against the figure, and the least it may be, in css px. */
const TIER_SIZE = 0.62;
const TIER_MIN_PX = 9;
/** Between the card's foot and the tier's line, in figure heights. */
const BELOW = 0.35;
/** The most of its card's width a line takes: a long one gets smaller instead. */
const WIDE = 0.96;
/** How far the tier's light is lifted towards white, to read on a stage of its own colour. */
const TIER_LIFT = 0.35;
const SOLD_COLOR = 0xb9bcc6;
/** How long a line takes to grow into place, in ms, and how small it starts. */
const IN_MS = 160;
const IN_FROM = 0.6;

/** `value` as the host writes its money. */
export function formatPrice(value, format) {
  const decimals = clamp(Math.round(format?.decimals ?? 2), 0, 8);
  return `${format?.prefix ?? ''}${value.toFixed(decimals)}${format?.suffix ?? ''}`;
}

const shadowOf = size => ({color: 0x000000, alpha: 0.55, blur: size * 0.35, distance: Math.max(1, size * 0.06), angle: Math.PI / 2});
/** A dark rim round the tier's word, so a word in a hit's colour still reads over that hit's own light. */
const rimOf = size => ({color: 0x000000, alpha: 0.7, width: Math.max(1.5, size * 0.2), join: 'round'});

export class PriceLabel {
  constructor(parent, font = FONT) {
    this.node = new Container();
    this.node.visible = false;
    parent.addChild(this.node);
    this.font = font || FONT;
    this.tierStyle = new TextStyle({
      fontFamily: this.font,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      fill: 0xffffff,
      stroke: rimOf(11),
      dropShadow: shadowOf(11),
      padding: 6,
    });
    this.tierText = new Text({text: '', style: this.tierStyle});
    this.tierText.anchor.set(0.5, 0);
    this.style = new TextStyle({
      fontFamily: this.font,
      fontSize: 18,
      fontWeight: '800',
      fill: 0xffffff,
      dropShadow: shadowOf(18),
      padding: 8,
    });
    this.text = new Text({text: '', style: this.style});
    this.text.anchor.set(0.5, 0);
    this.text.visible = false;
    this.node.addChild(this.tierText, this.text);
    this.price = null;
    this.format = null;
    this.tier = null;
    this.color = 0xffffff;
    this.sold = false;
    // The tier's line growing into place, and the figure's once it is shown, in ms since
    this.elapsed = 0;
    this.priceShown = false;
    this.priceClock = 0;
    // The width a line may take, and how far each shrinks to keep to it
    this.room = Infinity;
    this.fit = 1;
    this.tierFit = 1;
  }

  /** Nothing left to grow into place: nothing written, or all of it there. */
  get finished() {
    if (!this.node.visible) return true;
    return this.elapsed >= IN_MS && (!this.priceShown || this.priceClock >= IN_MS);
  }

  /** The family both lines are set in, as CSS names it. */
  setFont(font) {
    const family = font || FONT;
    if (family === this.font) return;
    this.font = family;
    this.style.fontFamily = family;
    this.tierStyle.fontFamily = family;
    this.refit();
  }

  /**
   * The card's `tier` in its `color` grows into place under it; its `price`
   * is kept for `showPrice`. A price that is not a number gets no figure, a
   * card with no tier no line, and one with neither nothing at all.
   */
  start(price, format, {tier = null, color} = {}) {
    this.price = typeof price === 'number' && Number.isFinite(price) ? price : null;
    this.format = format;
    this.tier = tier;
    this.color = toNumber(color, 0xffffff);
    this.sold = false;
    this.elapsed = 0;
    this.priceShown = false;
    this.priceClock = 0;
    this.text.visible = false;
    if (this.price === null && !this.tier) {
      this.hide();
      return;
    }
    this.node.visible = true;
    if (this.price !== null) this.text.text = formatPrice(this.price, this.format);
    this.writeTier();
    this.draw();
  }

  /** The figure grows into place under the tier: the large price over the card has left for the total. */
  showPrice() {
    if (this.priceShown || this.price === null || !this.node.visible) return;
    this.priceShown = true;
    this.priceClock = 0;
    this.text.visible = true;
    this.draw();
  }

  /** Sold: `SOLD` in place of the tier, the figure dimmed. */
  markSold() {
    if (this.sold) return;
    this.sold = true;
    if (this.node.visible) this.writeTier();
  }

  writeTier() {
    const word = this.sold ? 'SOLD' : (this.tier ?? '').toUpperCase();
    this.tierText.text = word;
    this.tierText.visible = word !== '';
    this.tierStyle.fill = this.sold ? SOLD_COLOR : mixNumbers(this.color, 0xffffff, TIER_LIFT);
    this.refit();
    this.draw();
  }

  /** Under the card whose box on the stage is `card`, sized to it. */
  place(card) {
    const size = clamp(card.width * SIZE, MIN_PX, MAX_PX);
    if (Math.abs(size - this.style.fontSize) > 0.25) {
      this.style.fontSize = size;
      this.style.dropShadow = shadowOf(size);
      this.style.padding = Math.ceil(size * 0.4);
      const tier = Math.max(TIER_MIN_PX, size * TIER_SIZE);
      this.tierStyle.fontSize = tier;
      this.tierStyle.letterSpacing = tier * 0.06;
      this.tierStyle.dropShadow = shadowOf(tier);
      this.tierStyle.stroke = rimOf(tier);
      this.tierStyle.padding = Math.ceil(tier * 0.4);
    }
    this.node.position.set(card.left + card.width / 2, card.bottom + size * BELOW);
    this.room = card.width * WIDE;
    this.refit();
    if (this.node.visible) this.draw();
  }

  /** Each line smaller when it is wider than the room it has, the figure's under the tier's. */
  refit() {
    const tierLine = this.tierText.visible ? this.tierStyle.fontSize * 1.25 : 0;
    this.text.position.set(0, tierLine);
    const tierWidth = this.tierText.visible ? CanvasTextMetrics.measureText(this.tierText.text, this.tierStyle).width : 0;
    this.tierFit = tierWidth > this.room ? this.room / tierWidth : 1;
    if (this.price === null) {
      this.fit = 1;
      return;
    }
    const full = CanvasTextMetrics.measureText(formatPrice(this.price, this.format), this.style).width;
    this.fit = full > this.room ? this.room / full : 1;
  }

  update(deltaMS) {
    if (!this.node.visible || this.finished) return;
    if (this.elapsed < IN_MS) this.elapsed += deltaMS;
    if (this.priceShown && this.priceClock < IN_MS) this.priceClock += deltaMS;
    this.draw();
  }

  /** All of it in place at once, the figure too: where a ceremony skipped to its end leaves it. */
  complete() {
    if (!this.node.visible) return;
    this.elapsed = IN_MS;
    if (this.price !== null) {
      this.priceShown = true;
      this.priceClock = IN_MS;
      this.text.visible = true;
    }
    this.draw();
  }

  /** Each line as far into place as its clock has it. */
  draw() {
    const tierIn = easeOut(clamp(this.elapsed / IN_MS, 0, 1));
    this.tierText.alpha = tierIn;
    this.tierText.scale.set(this.tierFit * (IN_FROM + (1 - IN_FROM) * tierIn));
    if (!this.priceShown) return;
    const priceIn = easeOut(clamp(this.priceClock / IN_MS, 0, 1));
    this.text.alpha = (this.sold ? 0.7 : 1) * priceIn;
    this.text.scale.set(this.fit * (IN_FROM + (1 - IN_FROM) * priceIn));
  }

  hide() {
    this.price = null;
    this.tier = null;
    this.sold = false;
    this.elapsed = 0;
    this.priceShown = false;
    this.priceClock = 0;
    this.text.visible = false;
    this.node.visible = false;
  }

  destroy() {
    this.node.destroy({children: true});
  }
}
