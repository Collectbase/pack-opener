/**
 * The combo, written under the grid once every card is face up: the host's
 * own words (`DOUBLE GRAIL`), drawn as given — large, heavy and slanted,
 * white with the hits' colour burning round it. It lands a little too large
 * and settles into its size — one hit counted — and gives a start for every
 * hit counted after (`repop`). It is not shaken with the stage.
 */
import {CanvasTextMetrics, Container, Text, TextStyle} from 'pixi.js';
import {clamp} from '../shared/geometry';
import {FONT} from './font';

/** The letters' height against the room under the grid, and the most they may be, in css px. */
const SIZE = 0.62;
const MAX_PX = 44;
/** How much larger than its size it comes down from. */
const LAND_FROM = 1.6;
/** The share of its time it takes to come down; it strikes there, and settles over the rest. */
const LAND_AT = 0.4;
/** How far it gives under its own weight after striking, as a share of its size. */
const SQUASH = 0.05;
/** A later beat: how small it starts back, how long it is held there, and how long the whole start takes, in ms. */
const REPOP_TO = 0.85;
const REPOP_HOLD_MS = 1000 / 15;
const REPOP_MS = 1000 / 6;

export class ComboBanner {
  constructor(parent, font = FONT) {
    this.node = new Container();
    this.node.visible = false;
    parent.addChild(this.node);
    this.font = font || FONT;
    this.text = null;
    this.label = '';
    this.color = 0xffffff;
    this.elapsed = 0;
    this.duration = 1;
    this.room = null;
    // Come down and not yet answered for: the scene shakes the stage once per landing
    this.struck = false;
    // Its size as it lands, and its start on a later beat, in ms since
    this.landed = 1;
    this.repopClock = Infinity;
  }

  /** Nothing left to land: none shown, or in place. */
  get finished() {
    return !this.node.visible || (this.elapsed >= this.duration && this.repopClock >= REPOP_MS);
  }

  /** Written under the grid, landing or landed. */
  get showing() {
    return this.node.visible;
  }

  /** `label` in the light of `color`, landing over `durationMs`. */
  show(label, color, durationMs) {
    this.label = String(label);
    this.color = color;
    this.elapsed = 0;
    this.duration = Math.max(1, durationMs);
    this.struck = false;
    this.repopClock = Infinity;
    this.build();
    this.node.visible = true;
    this.draw(0);
  }

  /** True once per landing, on the frame it comes down — never for one put in place at once. */
  takeStrike() {
    if (this.struck || !this.node.visible || this.elapsed < this.duration * LAND_AT) return false;
    this.struck = true;
    return true;
  }

  /** Another hit counted: it starts back, smaller, and springs to its size again. */
  repop() {
    if (!this.node.visible) return;
    this.repopClock = 0;
    this.size();
  }

  /** How much of its size it shows on a later beat: held small, then back. */
  get dip() {
    if (this.repopClock >= REPOP_MS) return 1;
    if (this.repopClock < REPOP_HOLD_MS) return REPOP_TO;
    const back = (this.repopClock - REPOP_HOLD_MS) / (REPOP_MS - REPOP_HOLD_MS);
    return REPOP_TO + (1 - REPOP_TO) * back * (2 - back);
  }

  size() {
    this.node.scale.set(this.landed * this.dip);
  }

  /** The family it is set in, as CSS names it. */
  setFont(font) {
    const family = font || FONT;
    if (family === this.font) return;
    this.font = family;
    if (this.node.visible) this.build();
  }

  /** The room it is written in: centred on (`x`, `y`), `width` × `height`. */
  place(x, y, width, height) {
    this.room = {x, y, width, height};
    this.node.position.set(x, y);
    if (this.node.visible) this.build();
  }

  build() {
    this.text?.destroy();
    this.text = null;
    const room = this.room;
    if (!room || !this.label) return;
    const style = new TextStyle({
      fontFamily: this.font,
      fontSize: Math.min(MAX_PX, room.height * SIZE),
      fontWeight: '900',
      fontStyle: 'italic',
      fill: 0xffffff,
      letterSpacing: 2,
    });
    // One line, smaller rather than wider than the room
    const wide = CanvasTextMetrics.measureText(this.label, style).width;
    if (wide > room.width) style.fontSize = Math.max(8, (style.fontSize * room.width) / wide);
    const size = style.fontSize;
    style.letterSpacing = size * 0.06;
    style.stroke = {color: this.color, width: Math.max(1, size * 0.05), join: 'round'};
    style.dropShadow = {color: this.color, alpha: 0.95, blur: size * 0.45, distance: 0, angle: 0};
    style.padding = Math.ceil(size * 0.5);
    this.text = new Text({text: this.label, style});
    this.text.anchor.set(0.5);
    this.node.addChild(this.text);
  }

  /** `deltaMS` of the ceremony's clock on; a later beat's start runs on the wall clock (`wallMS`), as the beat. */
  update(deltaMS, wallMS = deltaMS) {
    if (!this.node.visible) return;
    if (this.repopClock < REPOP_MS) {
      this.repopClock += wallMS;
      this.size();
    }
    if (this.elapsed >= this.duration) return;
    this.elapsed += deltaMS;
    this.draw(clamp(this.elapsed / this.duration, 0, 1));
  }

  /** Landed at once: in its place, at its size. */
  complete() {
    if (!this.node.visible) return;
    this.elapsed = this.duration;
    this.struck = true;
    this.repopClock = Infinity;
    this.draw(1);
  }

  /** Down from above its size, gathering speed, to strike at `LAND_AT`; then it gives a little and settles. */
  draw(t) {
    const fall = clamp(t / LAND_AT, 0, 1);
    const settle = clamp((t - LAND_AT) / (1 - LAND_AT), 0, 1);
    this.node.alpha = clamp(fall * 1.5, 0, 1);
    this.landed = fall < 1 ? LAND_FROM + (1 - LAND_FROM) * fall * fall : 1 - SQUASH * Math.sin(Math.PI * settle) * (1 - settle);
    this.size();
  }

  hide() {
    this.node.visible = false;
    this.label = '';
    this.elapsed = 0;
    this.repopClock = Infinity;
    this.text?.destroy();
    this.text = null;
  }

  destroy() {
    this.node.destroy({children: true});
  }
}
