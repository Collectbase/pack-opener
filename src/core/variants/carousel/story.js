/**
 * The pull, told before it is shown: its facts fading in one under the
 * other, a pill in the tier's colour under them, and — for a tier worth
 * shouting about — a banner sliding across the stage with the tier's name
 * running along it. All of it in text, the first text any scene has drawn:
 * the system's sans-serif, so nothing has to ship in the bundle.
 *
 * It owns the nodes; the scene says how far each moment has come.
 */
import {Container, Graphics, Text, TextStyle} from 'pixi.js';
import {clamp, easeInOut, easeOut} from '../shared/geometry';
import {toNumber} from '../../runtime/color';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** The banner's text repeats until it runs off both ends; a cap for a one-letter tier on a wide stage. */
const BANNER_REPEATS_MAX = 40;

export class Story {
  constructor(root, options) {
    this.root = root;
    this.o = options;
    this.node = new Container();
    this.node.alpha = 0;
    root.addChild(this.node);
    this.facts = [];
    this.pill = null;
    this.banner = null;
    this.screen = {width: 1, height: 1};
  }

  setOptions(options) {
    this.o = options;
  }

  /** Font sizes follow the stage, so a phone and a desktop read the same. */
  metrics(rect) {
    const unit = clamp(rect.width / 6, 16, 44);
    return {
      label: unit * 0.42,
      value: unit * 0.78,
      pill: unit * 0.5,
      banner: unit * 1.5,
      line: unit * 1.7,
      gap: unit * 0.35,
    };
  }

  /**
   * Builds the facts and the pill for this pull, laid out around the centre
   * of the stage. Facts arrive late as a rule — read here, at the moment
   * they are needed, not when the scene was built.
   */
  build(rect, screen) {
    this.clear();
    this.screen = screen;
    const facts = this.o.assets.card.facts;
    const badge = this.o.assets.card.badge;
    const m = this.metrics(rect);
    // How far a moment rises into place as it fades in
    this.rise = m.gap;
    const centreX = rect.left + rect.width / 2;
    const total = facts.length * m.line + (badge ? m.line : 0);
    let y = rect.top + rect.height / 2 - total / 2;

    for (const fact of facts) {
      const group = new Container();
      const label = new Text({
        text: String(fact.label).toUpperCase(),
        style: new TextStyle({
          fontFamily: FONT,
          fontSize: m.label,
          fill: 0xffffff,
          letterSpacing: m.label * 0.18,
        }),
      });
      label.alpha = 0.6;
      label.anchor.set(0.5, 0);
      const value = new Text({
        text: String(fact.value),
        style: new TextStyle({
          fontFamily: FONT,
          fontSize: m.value,
          fontWeight: '700',
          fill: 0xffffff,
        }),
      });
      value.anchor.set(0.5, 0);
      value.y = m.label * 1.35;
      group.addChild(label, value);
      group.position.set(centreX, y);
      group.baseY = y;
      group.alpha = 0;
      this.node.addChild(group);
      this.facts.push(group);
      y += m.line;
    }

    if (badge) {
      const pill = new Container();
      const color = toNumber(badge.color);
      const text = new Text({
        text: String(badge.label).toUpperCase(),
        style: new TextStyle({
          fontFamily: FONT,
          fontSize: m.pill,
          fontWeight: '800',
          fill: 0x111111,
          letterSpacing: m.pill * 0.08,
        }),
      });
      text.anchor.set(0.5);
      const padX = m.pill * 0.9;
      const padY = m.pill * 0.45;
      const w = text.width + padX * 2;
      const h = text.height + padY * 2;
      const back = new Graphics();
      // A soft glow of the same colour under the pill, then the pill itself
      back.roundRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, h / 2 + 6).fill({color, alpha: 0.35});
      back.roundRect(-w / 2, -h / 2, w, h, h / 2).fill({color});
      pill.addChild(back, text);
      pill.position.set(centreX, y + h / 2 + m.gap);
      pill.baseY = pill.y;
      pill.alpha = 0;
      this.node.addChild(pill);
      this.pill = pill;
    }
  }

  /** How many moments the story has: one per fact, one for the pill. */
  get beats() {
    return this.facts.length + (this.pill ? 1 : 0);
  }

  /** Moment `index` (a fact, or the pill last) at progress `t`. */
  showBeat(index, t) {
    const target = index < this.facts.length ? this.facts[index] : this.pill;
    if (!target) return;
    const eased = easeOut(clamp(t, 0, 1));
    target.alpha = eased;
    // Rises a little into place, the way a caption settles
    target.y = target.baseY + (1 - eased) * (this.rise ?? 0);
  }

  setAlpha(alpha) {
    this.node.alpha = alpha;
  }

  /**
   * The banner: a strip in the tier's colour across the stage, tilted, with
   * the tier's name repeated along it and running. Built for the stage as
   * a whole, so the strip runs off both edges.
   */
  buildBanner(rect, screen) {
    this.destroyBanner();
    const badge = this.o.assets.card.badge;
    if (!badge) return;
    const m = this.metrics(rect);
    const c = this.o.carousel;
    const strip = new Container();
    const height = m.banner * 1.4;
    const width = Math.hypot(screen.width, screen.height) * 1.4;
    const color = toNumber(badge.color);
    const back = new Graphics();
    back.rect(-width / 2, -height / 2, width, height).fill({color});
    strip.addChild(back);

    const style = new TextStyle({
      fontFamily: FONT,
      fontSize: m.banner,
      fontWeight: '900',
      fontStyle: 'italic',
      fill: 0xffffff,
      letterSpacing: m.banner * 0.04,
    });
    const word = `${String(badge.label).toUpperCase()}!`;
    const run = new Container();
    // The word repeats until it runs off both ends of the strip, plus one
    // more period for the scroll to wrap in
    let x = 0;
    let period = 0;
    do {
      const t = new Text({text: word, style});
      t.anchor.set(0, 0.5);
      t.x = x;
      run.addChild(t);
      period = t.width + m.banner * 1.1;
      x += period;
    } while (x < width + period && run.children.length < BANNER_REPEATS_MAX);
    this.period = period;
    run.x = -width / 2;
    strip.addChild(run);
    this.bannerRun = run;

    strip.rotation = (c.bannerTilt * Math.PI) / 180;
    strip.position.set(screen.width / 2, rect.top + rect.height / 2);
    strip.alpha = 0;
    this.root.addChild(strip);
    this.banner = strip;
    this.bannerWidth = width;
  }

  /**
   * The banner crossing: it slides in from the left over `t` in 0..1 while
   * the text runs along it, and keeps running while it holds.
   */
  showBanner(t, runMs) {
    if (!this.banner) return;
    const eased = easeInOut(clamp(t, 0, 1));
    this.banner.alpha = clamp(t * 4, 0, 1);
    // Slides in from off the left edge to its place
    const slide = (1 - eased) * -this.bannerWidth * 0.35;
    this.banner.x = this.screen.width / 2 + slide;
    const run = this.bannerRun;
    if (run && this.period) {
      run.x = -this.bannerWidth / 2 - ((runMs * 0.12) % this.period);
    }
  }

  hideBanner(t) {
    if (!this.banner) return;
    this.banner.alpha = clamp(1 - t, 0, 1);
  }

  destroyBanner() {
    if (this.banner) {
      this.banner.destroy({children: true});
      this.banner = null;
      this.bannerRun = null;
    }
  }

  clear() {
    this.node.removeChildren().forEach(child => child.destroy({children: true}));
    this.facts = [];
    this.pill = null;
    this.node.alpha = 0;
    this.destroyBanner();
  }

  destroy() {
    this.clear();
    this.node.destroy({children: true});
  }
}
