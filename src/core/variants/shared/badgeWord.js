/**
 * The pull's badge as a giant outline word behind the landed card — the
 * host's own winner screen did it in its page, under the scene's canvas,
 * where only that host had it. Drawn here, every host gets it, the React
 * Native WebView included.
 *
 * Off unless `motion.reveal.badgeWord` is on, and only for a pull that has
 * `assets.card.badge`: which tiers deserve the word is the host's call, made
 * by passing a badge or not.
 *
 * Shared by the mechanics that land a card without saying what it is first
 * (`slice`, `burst`); the carousel shouts the tier on its banner instead.
 */
import {CanvasSource, Sprite, Texture} from 'pixi.js';
import {easeOut} from './geometry';

/** The word's size against the stage's width, and the bounds it keeps to. */
const SIZE_SHARE = 0.4;
const SIZE_MIN = 220;
const SIZE_MAX = 480;

/** How far the word ends up stretched sideways — it opens out from the centre to this. */
const STRETCH = 1.18;

/** Outline only: the stroke's width in css px, and how strongly the word shows. */
const STROKE = 2;
const ALPHA = 0.55;

/** Air between the letters, as a share of the size. */
const TRACKING = 0.04;

/**
 * The word fades towards the stage's edges, so it never slams into them: an
 * ellipse of this share of the stage's width and height, solid out to the
 * first stop and gone by the second.
 */
const FADE_X = 0.65;
const FADE_Y = 0.55;
const FADE_FROM = 0.25;
const FADE_TO = 0.88;

/** How long it takes to open out, and to come up, after a beat. */
const OPEN_MS = 1000;
const SHOW_MS = 550;
const SHOW_DELAY_MS = 100;

/** Easing the opening out the way the page did, fast and long to settle. */
const easeOutExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** The word as it is drawn — options that change it make a new one. */
function wordOf(o) {
  const badge = o.assets.card.badge;
  if (!o.motion.reveal.badgeWord || !badge) {
    return null;
  }
  return {label: String(badge.label).toUpperCase(), color: badge.color, font: o.theme.badgeFont};
}

const sameWord = (a, b) =>
  a === b || (!!a && !!b && a.label === b.label && a.color === b.color && a.font === b.font);

/**
 * The word, stroked once onto a canvas at its final width, with the fade to
 * the stage's edges cut into it. `size` is the font size, `screen` the stage.
 */
function makeWordTexture(word, size, screen) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const font = `400 ${size}px ${word.font}`;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  measure.letterSpacing = `${size * TRACKING}px`;
  measure.textAlign = 'left';
  measure.textBaseline = 'alphabetic';
  // The letters themselves go on the centre, not the font's em box: centred
  // on 'middle', Bebas's capitals sat a tenth of the size high, and the
  // tracking left a gap after the last letter that pushed the word left
  const ink = measure.measureText(word.label);
  const inkWidth = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight;
  const inkX = (ink.actualBoundingBoxRight - ink.actualBoundingBoxLeft) / 2;
  const inkY = (ink.actualBoundingBoxDescent - ink.actualBoundingBoxAscent) / 2;

  // The fade is laid out against the stage, but the canvas only has to hold
  // what of the word survives it: nothing past the ellipse's far edge
  const rx = screen.width * FADE_X;
  const ry = screen.height * FADE_Y;
  const width = Math.min(inkWidth * STRETCH, rx * FADE_TO * 2) + STROKE * 2;
  const height = Math.min(size * 1.3, ry * FADE_TO * 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(STRETCH, 1);
  ctx.font = font;
  ctx.letterSpacing = `${size * TRACKING}px`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = STROKE / STRETCH;
  ctx.strokeStyle = word.color;
  ctx.strokeText(word.label, -inkX, -inkY);
  ctx.restore();

  // The fade, as an ellipse: a circle squashed to the stage's proportions
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(width / 2, height / 2);
  ctx.scale(1, ry / rx);
  const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  fade.addColorStop(FADE_FROM, 'rgba(0,0,0,1)');
  fade.addColorStop(FADE_TO, 'rgba(0,0,0,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(-width, -height * (rx / ry), width * 2, height * 2 * (rx / ry));

  // Drawn at the screen's density: told so, it comes out at its size in css px
  return new Texture({source: new CanvasSource({resource: canvas, resolution: dpr})});
}

export class BadgeWord {
  /** `sceneRoot` is the variant's own container, `screen` the renderer's size. */
  constructor(sceneRoot, screen, options) {
    this.sceneRoot = sceneRoot;
    this.screen = screen;
    this.o = options;
    this.node = null;
    this.word = null;
    this.centre = null;
    this.clock = 0;
    this.preload();
  }

  /**
   * A web font the host names is only fetched once something on the page
   * uses it; the word is drawn the moment the card lands, so it is asked
   * for ahead, or the first pull would get the fallback.
   */
  preload() {
    const word = wordOf(this.o);
    if (word && typeof document !== 'undefined' && document.fonts) {
      document.fonts.load(`400 ${SIZE_MIN}px ${word.font}`, word.label).catch(() => {});
    }
  }

  /** A badge that arrives late, or a switch turned while the card is down, shows at once. */
  setOptions(options) {
    this.o = options;
    this.preload();
    if (this.centre) {
      this.draw();
    }
  }

  get busy() {
    return !!this.node && this.clock < SHOW_DELAY_MS + Math.max(OPEN_MS, SHOW_MS);
  }

  /** Starts its arrival behind the card, centred on where it came to rest. */
  reveal(card) {
    this.centre = {x: (card.left + card.right) / 2, y: (card.top + card.bottom) / 2};
    this.clock = 0;
    this.draw();
  }

  draw() {
    const word = wordOf(this.o);
    if (sameWord(word, this.word) && (this.node || !word)) {
      return;
    }
    this.destroy();
    this.word = word;
    if (!word) {
      return;
    }
    const size = Math.min(SIZE_MAX, Math.max(SIZE_MIN, this.screen.width * SIZE_SHARE));
    this.node = new Sprite(makeWordTexture(word, size, this.screen));
    this.node.anchor.set(0.5);
    this.node.position.set(this.centre.x, this.centre.y);
    // Under the card and its stand: both are at the bottom of the scene by
    // the time it lands, so the word goes below them
    this.sceneRoot.addChildAt(this.node, 0);
    this.apply();
  }

  update(deltaMS) {
    if (!this.busy) {
      return;
    }
    this.clock += deltaMS;
    this.apply();
  }

  apply() {
    const open = easeOutExpo(Math.min(1, this.clock / OPEN_MS));
    const shown = easeOut(Math.min(1, Math.max(0, this.clock - SHOW_DELAY_MS) / SHOW_MS));
    this.node.scale.x = open;
    this.node.alpha = ALPHA * shown;
  }

  rewind() {
    this.destroy();
    this.word = null;
    this.centre = null;
    this.clock = 0;
  }

  destroy() {
    this.node?.destroy({texture: true, textureSource: true});
    this.node = null;
  }
}
