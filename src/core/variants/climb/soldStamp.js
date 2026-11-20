/**
 * The stamp a sold card takes: `SOLD` in red ink inside a double frame,
 * set slanted across the card's face. It comes down on the card from above
 * — large and faint, gathering weight — lands pressed in a touch, and stands
 * there at its size: as if the card had been stamped. A card put up sold by
 * a skip takes it already stamped.
 */
import {Container, Graphics, Text, TextStyle} from 'pixi.js';
import {FONT} from './font';
import {STAMP, stampAt} from './stampMotion';

/** The ink, the slant and how much of the card's width the stamp takes. */
const INK = 0xe0262f;
const INK_ALPHA = 0.92;
const SLANT = (-14 * Math.PI) / 180;
const WIDE = 0.74;

export class SoldStamp {
  constructor(parent, font = FONT) {
    this.node = new Container();
    this.node.visible = false;
    this.node.rotation = SLANT;
    this.node.alpha = INK_ALPHA;
    parent.addChild(this.node);
    this.frame = new Graphics();
    this.style = new TextStyle({fontFamily: font || FONT, fontWeight: '900', fontSize: 24, fill: INK, letterSpacing: 3});
    this.text = new Text({text: 'SOLD', style: this.style});
    this.text.anchor.set(0.5);
    this.node.addChild(this.frame, this.text);
    // ms since it started to come down; Infinity once it stands, or before it has started
    this.clock = Infinity;
    this.width = 0;
  }

  /** On a card `width` px wide. */
  place(width) {
    if (!(width > 0) || Math.abs(width - this.width) < 0.5) return;
    this.width = width;
    const size = width * WIDE * 0.24;
    this.style.fontSize = size;
    this.style.letterSpacing = size * 0.12;
    const w = width * WIDE;
    const h = size * 1.55;
    const line = Math.max(1.5, size * 0.09);
    this.frame.clear();
    this.frame.roundRect(-w / 2, -h / 2, w, h, size * 0.22).stroke({color: INK, width: line});
    this.frame.roundRect(-w / 2 + line * 2, -h / 2 + line * 2, w - line * 4, h - line * 4, size * 0.15).stroke({color: INK, width: line * 0.45});
  }

  /** Comes down on the card — or, `atOnce`, stands there already. */
  stamp(atOnce = false) {
    this.node.visible = true;
    this.clock = atOnce ? Infinity : 0;
    this.draw();
  }

  /** Off the card. */
  lift() {
    this.node.visible = false;
    this.clock = Infinity;
  }

  /** Still coming down or settling. */
  get moving() {
    return this.node.visible && this.clock < STAMP.fallMs + STAMP.settleMs;
  }

  update(deltaMS) {
    if (!this.moving) return;
    this.clock += deltaMS;
    this.draw();
  }

  draw() {
    const {scale, alpha} = stampAt(this.clock);
    this.node.scale.set(scale);
    this.node.alpha = INK_ALPHA * alpha;
  }

  setFont(font) {
    this.style.fontFamily = font || FONT;
  }

  destroy() {
    this.node.destroy({children: true});
  }
}
