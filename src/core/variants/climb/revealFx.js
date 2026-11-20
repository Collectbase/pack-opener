/**
 * What a card throws off as it comes face up — light, never matter: nothing
 * here flies off as a solid piece. One of three styles (`climb.reveal`):
 *
 * - `flare` — a ring of light leaves the card's outline and widens as it
 *   fades, a short fan of rays opens from behind the card, a few stars catch
 *   round it;
 * - `motes` — soft round motes are born along the card's edges, drift out a
 *   little and rise, with a few stars;
 * - `pixels` — small square sparks are thrown from the card's edges, stop
 *   almost at once and rise: the dust behind the stage (`dust.js`), fed by
 *   the reveal.
 *
 * A hit throws about twice what an ordinary card does, and further. Apart
 * from the styles, a card takes one band of sheen across its face, and a hit
 * a star at its corner. Everything is white, baked once and tinted in the
 * card's colour, and drawn as light added to what it crosses. The sprites
 * are pooled, and never more than `MAX_ALIVE` are alight at a time, so
 * sixteen cards turning at 4× cost a phone no more than one does.
 */
import {Container, Sprite, Texture, TilingSprite} from 'pixi.js';
import {mixNumbers} from '../../runtime/color';
import {clamp, easeOut} from '../shared/geometry';
import {makeSoftDotTexture, makeTwinkleTexture} from '../shared/textures';

/** The most lights alight at a time; past it a card throws nothing more. */
export const MAX_ALIVE = 120;

/** The styles a card may come up in; any other name is the first of them. */
const STYLES = ['flare', 'motes', 'pixels'];
/** The largest grid of each rung of `THROWN` but the last. */
const CROWDS = [1, 4, 9];
/**
 * What an ordinary card throws in each style, by how many cards share the
 * grid — one, up to four, up to nine, more: the more of them, the smaller
 * each is and the less it throws. A hit throws twice as much, its one fan of
 * rays aside. Sized so that what is alight at once stays under `MAX_ALIVE`:
 * the ordinary cards turn one after another and a light lasts a second at
 * most, so no more than five cards' worth; the hits turn together, and half
 * a full grid of them still fits, each with the star at its corner.
 */
const THROWN = {
  flare: {ring: [1, 1, 1, 1], rays: [1, 1, 1, 1], twinkle: [6, 4, 3, 2]},
  motes: {mote: [26, 12, 9, 6], twinkle: [4, 2, 2, 1]},
  pixels: {pixel: [44, 14, 11, 7]},
};

/**
 * The card the ring and the fan are baked round, in card widths: how tall it
 * is and how round its corners. Each is stretched to the card it is thrown
 * from, so a card of another shape still gets its own outline.
 */
const CARD_TALL = 1.5;
const CARD_ROUND = 0.06;

/** The ring's canvas: px to a card's width. Soft light, so few will do. */
const RING_PX = 96;
/**
 * The ring across its width: a soft band of light with a thin hot line
 * along its middle — how wide each is, in card widths, and how bright.
 */
const RING_BAND = {wide: 0.08, bright: 0.5};
const RING_LINE = {wide: 0.028, bright: 0.3};
/** How round the ring's corners are, in card widths: rounder than the card's, as a wave of light is. */
const RING_ROUND = 0.12;
/** How much wider than the card a ring gets as it fades, and how long it takes, in ms of the scene's time. */
const RING_GROW = 0.5;
const RING_MS = 400;
/** A hit's second ring: how long after the first it leaves, how much further it goes, how much longer it takes and how much fainter it is. */
const RING_BEAT_MS = 110;
const RING_MORE = {grow: 0.4, ms: 120, dim: 0.3};

/** The fan's canvas: px to a card's width. Soft light, so few will do — and it is baked on a frame of the ceremony. */
const FAN_PX = 72;
/** The rays of a fan, and the directions it is baked by. */
const FAN_RAYS = 28;
const FAN_BINS = 720;
/** A ray's half-width, in radians, and its length against the longest: each ray takes its own between these. */
const RAY_WIDE = {min: 0.025, max: 0.075};
const RAY_LONG = {min: 0.45, max: 1};
/** The haze between the rays: how bright against a ray, and how far it reaches against the longest of them. */
const FAN_HAZE = 0.25;
const FAN_HAZE_REACH = 0.5;
/** How far inside the card's outline the fan begins, in card widths: no dark seam between the card and its light. */
const FAN_INSIDE = 0.02;
/** A fan grows this much as it opens — away from the card, never over its face — and is at its brightest this share of its life in. */
const FAN_OPEN = 0.12;
const FAN_RISE = 0.15;
/**
 * How far past the card's outline the longest ray reaches, in card widths,
 * and how long the fan lasts: an ordinary card's rays, and a hit's beams.
 */
const RAYS = {reach: 0.7, ms: 300};
const BEAMS = {reach: 1.1, ms: 420};
/** How many frames after a card's rays the hits' beams are baked: ahead of the hits, and not on the frame that baked the rays. */
const BEAMS_AFTER = 2;

const TWINKLE_PX = 96;
const MOTE_PX = 64;
/** How long a mote lasts, and the longest it waits to be born, in ms: they do not all come at once. */
const MOTE_MS = {min: 600, max: 900};
const MOTE_WAIT_MS = 110;
/** A mote is at its brightest this share of its life in, stays so until this share, and is this much smaller by its end. */
const MOTE_RISE = 0.12;
const MOTE_HOLD = 0.4;
const MOTE_SHRINK = 0.4;
/** How much a mote swings from side to side over its life, in radians: a little more than once across and back. */
const MOTE_SWAY = 7;
/** A hit's motes are this much larger and drift this much further, and every one in this many is white. */
const MOTE_HIT_SCALE = 1.35;
const MOTE_HIT_WHITE = 3;

/** The side of a spark's square on its canvas, in px; the canvas is twice that, for the glow round it. */
const PIXEL_CORE = 8;
const PIXEL_GLOW = 0.5;
/** The largest spark's side, as a share of the card's width and within these css px; the smallest is this share of it. */
const PIXEL_SIDE = 0.075;
const PIXEL_SIDE_PX = {min: 5.5, max: 8};
const PIXEL_SMALLEST = 0.5;
/** How long a spark lasts, in ms. */
const PIXEL_MS = {min: 700, max: 1000};
/** A spark has spent its throw within about three of these, in ms: thrown fast and stopped at once. */
const PIXEL_STOP_MS = 80;
/** How far a spark is thrown, in card widths — most of them near the least of it, a few near the most. */
const PIXEL_REACH = {min: 0.12, max: 0.62};
/** How far off the way out of the card a spark may be thrown, in radians. */
const PIXEL_FAN = 0.6;
/** A spark stays at its brightest until this share of its life, is this much smaller by its end, and blinks this deep. */
const PIXEL_HOLD = 0.45;
const PIXEL_SHRINK = 0.4;
const PIXEL_BLINK = 0.35;
/** A hit's sparks are thrown this much further; every one in this many is the whiter tone — an ordinary card's, fewer. */
const PIXEL_HIT_REACH = 1.35;
const PIXEL_PALE_EVERY = {card: 4, hit: 2};

/** How far each tint is lifted towards white: light takes a card's colour, it is not painted in it. */
const RING_LIFT = 0.5;
const FAN_LIFT = 0.35;
const TWINKLE_LIFT = 0.7;
const MOTE_LIFT = 0.35;
const PIXEL_LIFT = 0.15;
const PIXEL_PALE_LIFT = 0.8;

/** The sheen crossing a card, in ms of the scene's time, and how bright it gets. */
const SHEEN_MS = 320;
const SHEEN_ALPHA = 0.6;
/** How far the sheen's band leans, as its run across per unit of height. */
const SHEEN_LEAN = 0.5;
/** The card sizes a band of sheen is kept baked for: a lone card's, a grid's and the grid before it. */
const SHEEN_KEPT = 3;

const TWO_PI = Math.PI * 2;
/** The turn that never lands twice on the same direction: rays set this far apart spread evenly, however many. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const between = (min, max) => min + Math.random() * (max - min);
/** What is left of `x` past its whole part: a number that looks drawn by lot and is the same every time. */
const part = x => x - Math.floor(x);

/**
 * How many of each light a card of a grid of `crowd` throws as it comes up
 * in `style`: twice as many for a `hit`, its one fan of rays aside.
 */
export function revealCounts(style, crowd, hit = false) {
  const thrown = THROWN[STYLES.includes(style) ? style : STYLES[0]];
  const found = CROWDS.findIndex(most => crowd <= most);
  const rung = found < 0 ? CROWDS.length : found;
  const of = kind => (thrown[kind]?.[rung] ?? 0) * (hit && kind !== 'rays' ? 2 : 1);
  return {ring: of('ring'), rays: of('rays'), twinkle: of('twinkle'), mote: of('mote'), pixel: of('pixel')};
}

/**
 * The point `share` (0..1) of the way round the outline of `card`, clockwise
 * from its top left corner, and the way out of the card there, from its
 * centre (`nx`, `ny`, one long).
 */
export function edgeAt(card, share) {
  const {width, height} = card;
  const along = part(share) * 2 * (width + height);
  let x = 0;
  let y = 0;
  if (along < width) {
    x = along;
  } else if (along < width + height) {
    x = width;
    y = along - width;
  } else if (along < 2 * width + height) {
    x = 2 * width + height - along;
    y = height;
  } else {
    y = 2 * (width + height) - along;
  }
  const dx = x - width / 2;
  const dy = y - height / 2;
  const far = Math.hypot(dx, dy) || 1;
  return {x: card.left + x, y: card.top + y, nx: dx / far, ny: dy / far};
}

/** How bright a light is `t` (0..1) of the way through its life: up over the first `rise` of it, full until `hold`, down over the rest. */
export const glowAt = (t, rise, hold = rise) => (t < rise ? t / rise : t < hold ? 1 : (1 - t) / (1 - hold));

/** The share of its throw a spark has covered `ms` in: nearly all of it within a few `PIXEL_STOP_MS`. */
export const thrownAt = ms => 1 - Math.exp(-ms / PIXEL_STOP_MS);

/** How long a spark has been rising at its full pace `ms` in: it takes to rising as its throw is spent. */
export const risenAt = ms => ms - PIXEL_STOP_MS * thrownAt(ms);

/**
 * How far (`x`, `y`) lies outside the outline of the card the lights are
 * baked round, its corners `round`, from its centre, in card widths;
 * negative inside it.
 */
function outsideOf(x, y, round) {
  const qx = Math.abs(x) - 0.5 + round;
  const qy = Math.abs(y) - CARD_TALL / 2 + round;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - round;
}

/** A soft bump: 1 at 0, a little over a half at 1, next to nothing past 3. */
const bell = x => Math.exp(-0.5 * x * x);

/**
 * White light on a canvas `px` to a card's width, the card in its middle and
 * `halfWidth` × `halfHeight` card widths from there to its edges: as bright
 * at each point as `lightAt(x, y)` says (0..1), in card widths from the
 * card's centre.
 */
function bakeLight(halfWidth, halfHeight, px, lightAt) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(halfWidth * 2 * px);
  canvas.height = Math.ceil(halfHeight * 2 * px);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  const data = image.data;
  for (let row = 0; row < canvas.height; row++) {
    const y = (row + 0.5 - canvas.height / 2) / px;
    for (let column = 0; column < canvas.width; column++) {
      const i = (row * canvas.width + column) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(clamp(lightAt((column + 0.5 - canvas.width / 2) / px, y), 0, 1) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return Texture.from(canvas);
}

/**
 * The fan by direction: how bright it is that way (`light`) and how far it
 * reaches, as a share of its longest ray (`long`). Rays of different widths,
 * lengths and brightness, the same every time it is drawn.
 */
function fanOf() {
  const light = new Float32Array(FAN_BINS);
  const long = new Float32Array(FAN_BINS);
  for (let bin = 0; bin < FAN_BINS; bin++) {
    const angle = (bin / FAN_BINS) * TWO_PI;
    let sum = 0;
    let reach = 0;
    for (let ray = 0; ray < FAN_RAYS; ray++) {
      const off = Math.abs(part((angle - ray * GOLDEN_ANGLE) / TWO_PI + 0.5) - 0.5) * TWO_PI;
      const wide = RAY_WIDE.min + (RAY_WIDE.max - RAY_WIDE.min) * part(ray * 0.618);
      if (off > wide * 3) continue;
      const lit = (0.55 + 0.45 * part(ray * 0.755)) * bell(off / wide);
      sum += lit;
      reach += lit * (RAY_LONG.min + (RAY_LONG.max - RAY_LONG.min) * part(ray * 0.381 + 0.3));
    }
    light[bin] = Math.min(1, sum);
    long[bin] = sum > 0 ? reach / sum : 1;
  }
  return {light, long};
}

/** How bright a ray is `along` (0..1) of the way to its tip: brightest at the card, gone at the tip. */
function fadeAlong(along) {
  const left = 1 - Math.max(0, along);
  return left > 0 ? left * Math.sqrt(left) : 0;
}

/**
 * A fan of soft rays round the card and a haze between them, reaching
 * `reach` card widths past its outline — and nothing where the card is: the
 * fan is drawn over the cards and has to look as if it came from behind one.
 */
function bakeFan(reach) {
  const {light, long} = fanOf();
  return bakeLight(0.5 + reach, CARD_TALL / 2 + reach, FAN_PX, (x, y) => {
    const out = outsideOf(x, y, CARD_ROUND);
    if (out <= -FAN_INSIDE || out >= reach) return 0;
    const bin = Math.floor(part(Math.atan2(y, x) / TWO_PI) * FAN_BINS) % FAN_BINS;
    const ray = light[bin] * fadeAlong(out / (reach * long[bin]));
    const haze = FAN_HAZE * fadeAlong(out / (reach * FAN_HAZE_REACH));
    // Faded in from just inside the outline, so the fan has no edge of its own there
    return (ray + haze) * clamp((out + FAN_INSIDE) / (FAN_INSIDE * 1.5), 0, 1);
  });
}

/** The outline of the card as a ring of light: a soft band with a hot line along its middle. */
function bakeRing() {
  const pad = RING_BAND.wide * 3;
  return bakeLight(0.5 + pad, CARD_TALL / 2 + pad, RING_PX, (x, y) => {
    const out = outsideOf(x, y, RING_ROUND);
    if (Math.abs(out) >= pad) return 0;
    return RING_BAND.bright * bell(out / RING_BAND.wide) + RING_LINE.bright * bell(out / RING_LINE.wide);
  });
}

/** A square spark: a hard bright square with a little glow round it. */
function bakePixel() {
  const size = PIXEL_CORE * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, `rgba(255,255,255,${PIXEL_GLOW})`);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(c - PIXEL_CORE / 2, c - PIXEL_CORE / 2, PIXEL_CORE, PIXEL_CORE);
  return Texture.from(canvas);
}

/** One leaning band of light on a strip three cards wide, so a card's width of it never shows two. */
function bakeSheen(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * 3));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext('2d');
  const half = width * 0.22;
  const middle = width * 1.5;
  ctx.transform(1, 0, -SHEEN_LEAN, 1, (SHEEN_LEAN * height) / 2, 0);
  const band = ctx.createLinearGradient(middle - half, 0, middle + half, 0);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  band.addColorStop(0.5, 'rgba(255,255,255,1)');
  band.addColorStop(0.65, 'rgba(255,255,255,0.4)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fillRect(middle - half - height, 0, half * 2 + height * 2, height);
  return Texture.from(canvas);
}

/** The light each kind of sprite is made of, baked when the first of its kind is thrown. */
const BAKED = {
  ring: bakeRing,
  rays: () => bakeFan(RAYS.reach),
  beams: () => bakeFan(BEAMS.reach),
  twinkle: () => makeTwinkleTexture(TWINKLE_PX),
  mote: () => makeSoftDotTexture(MOTE_PX),
  pixel: bakePixel,
};

/** A fan opens a little from behind the card, bright almost at once, and fades. */
function moveFan(sprite, p, t) {
  const open = 1 + FAN_OPEN * easeOut(t);
  sprite.position.set(p.x, p.y);
  sprite.scale.set(p.sx * open, p.sy * open);
  sprite.alpha = p.alpha * glowAt(t, FAN_RISE);
}

/** Where each kind of light is and how it shows, `t` (0..1) of the way through its life. */
const MOVES = {
  /** A ring leaves the card's outline and widens, fading as it goes. */
  ring(sprite, p, t) {
    const grown = 1 + p.grow * easeOut(t);
    const left = 1 - t;
    sprite.position.set(p.x, p.y);
    sprite.scale.set(p.sx * grown, p.sy * grown);
    sprite.alpha = p.alpha * left * left;
  },
  rays: moveFan,
  beams: moveFan,
  /** A star swells out of nothing where it stands and goes back, turning a little. */
  twinkle(sprite, p, t) {
    const swell = Math.sin(Math.PI * t);
    sprite.position.set(p.x, p.y);
    sprite.rotation = p.turn + p.spin * t;
    sprite.scale.set(p.scale * swell);
    sprite.alpha = p.alpha * swell;
  },
  /** A mote drifts out from the edge it was born on and rises, swinging a little. */
  mote(sprite, p, t) {
    const out = easeOut(t);
    sprite.position.set(p.x + p.dx * out + Math.sin(p.phase + MOTE_SWAY * t) * p.sway, p.y + p.dy * out - p.rise * t);
    sprite.scale.set(p.scale * (1 - MOTE_SHRINK * t));
    sprite.alpha = p.alpha * glowAt(t, MOTE_RISE, MOTE_HOLD);
  },
  /** A spark is thrown out, stops almost at once and rises from there, blinking. */
  pixel(sprite, p, t) {
    const out = thrownAt(p.elapsed);
    const blink = 0.5 + 0.5 * Math.sin(p.phase + p.rate * p.elapsed);
    sprite.position.set(p.x + p.dx * out, p.y + p.dy * out - p.rise * risenAt(p.elapsed));
    sprite.scale.set(p.scale * (1 - PIXEL_SHRINK * t));
    sprite.alpha = p.alpha * glowAt(t, 0, PIXEL_HOLD) * (1 - PIXEL_BLINK * blink);
  },
};

export class RevealFx {
  constructor(parent) {
    this.node = new Container();
    parent.addChild(this.node);
    // The lights, by kind: each baked when the first of its kind is thrown — the beams, `ahead` frames from now
    this.textures = {};
    this.ahead = 0;
    // The lights alight, and the sprites at rest, by kind
    this.alive = [];
    this.free = {ring: [], rays: [], beams: [], twinkle: [], mote: [], pixel: []};
    // Bands of sheen crossing a card, and their textures by card size
    this.sheens = [];
    this.sheenTextures = new Map();
  }

  /** Something is still alight: the scene is not at rest. */
  get live() {
    return this.alive.length > 0 || this.sheens.length > 0;
  }

  spriteOf(kind) {
    let sprite = this.free[kind].pop();
    if (!sprite) {
      this.textures[kind] ??= BAKED[kind]();
      sprite = new Sprite(this.textures[kind]);
      sprite.anchor.set(0.5);
      // Light, not paint: it brightens what it crosses
      sprite.blendMode = 'add';
      this.node.addChild(sprite);
    }
    return sprite;
  }

  /** One more light of `kind`, its sprite dressed by `dress`; none past the budget. */
  spawn(kind, particle, dress) {
    if (this.alive.length >= MAX_ALIVE) return;
    const sprite = this.spriteOf(kind);
    dress(sprite);
    sprite.visible = false;
    this.alive.push({kind, sprite, elapsed: 0, ...particle});
  }

  /**
   * Card `card` (its box on the stage, css px) comes face up in `color`, in
   * `style`: it throws what `revealCounts` gives it — a `hit` twice as much,
   * and further; a card of a larger grid (`crowd`), less.
   */
  burst(card, color, {style = 'flare', hit = false, crowd = 1} = {}) {
    const counts = revealCounts(style, crowd, hit);
    this.rings(card, color, counts.ring);
    this.fan(card, color, counts.rays, hit);
    this.motes(card, color, counts.mote, hit);
    this.sparks(card, color, counts.pixel, hit);
    this.stars(card, color, counts.twinkle);
  }

  /** `n` rings of light off the outline of `card`, each a beat after the one before, wider and slower. */
  rings(card, color, n) {
    const tint = mixNumbers(color, 0xffffff, RING_LIFT);
    for (let i = 0; i < n; i++) {
      const ring = {
        wait: i * RING_BEAT_MS,
        life: RING_MS + i * RING_MORE.ms,
        x: card.left + card.width / 2,
        y: card.top + card.height / 2,
        sx: card.width / RING_PX,
        sy: card.height / (RING_PX * CARD_TALL),
        grow: RING_GROW + i * RING_MORE.grow,
        alpha: 1 - i * RING_MORE.dim,
      };
      this.spawn('ring', ring, sprite => {
        sprite.tint = tint;
      });
    }
  }

  /** The fan of rays from behind `card` — a hit's reach further and last longer. */
  fan(card, color, n, hit) {
    const {ms} = hit ? BEAMS : RAYS;
    const tint = mixNumbers(color, 0xffffff, FAN_LIFT);
    for (let i = 0; i < n; i++) {
      const fan = {
        wait: 0,
        life: ms,
        x: card.left + card.width / 2,
        y: card.top + card.height / 2,
        sx: card.width / FAN_PX,
        sy: card.height / (FAN_PX * CARD_TALL),
        alpha: 1,
      };
      this.spawn(hit ? 'beams' : 'rays', fan, sprite => {
        sprite.tint = tint;
      });
    }
    // The hits turn together, under the flash: that frame should not have their beams to bake as well
    if (n > 0 && !hit && !this.textures.beams && !this.ahead) this.ahead = BEAMS_AFTER;
  }

  /** `n` stars of light round `card`, one after another. */
  stars(card, color, n) {
    const cx = card.left + card.width / 2;
    const cy = card.top + card.height / 2;
    const w = card.width;
    const light = mixNumbers(color, 0xffffff, TWINKLE_LIFT);
    for (let i = 0; i < n; i++) {
      const angle = ((i + Math.random()) / n) * TWO_PI;
      const out = 1 + between(0.1, 0.35);
      const twinkle = {
        wait: i * 60 + between(0, 80),
        life: between(420, 560),
        x: cx + Math.cos(angle) * (card.width / 2) * out,
        y: cy + Math.sin(angle) * (card.height / 2) * out,
        turn: between(-0.3, 0.3),
        spin: 0.6,
        scale: clamp(w * between(0.3, 0.55), 14, 130) / TWINKLE_PX,
        alpha: 1,
      };
      this.spawn('twinkle', twinkle, sprite => {
        sprite.tint = light;
      });
    }
  }

  /** `n` motes born round the edges of `card` — a hit's larger, some of them white. */
  motes(card, color, n, hit) {
    const w = card.width;
    const tint = mixNumbers(color, 0xffffff, MOTE_LIFT);
    const size = hit ? MOTE_HIT_SCALE : 1;
    for (let i = 0; i < n; i++) {
      const from = edgeAt(card, (i + Math.random()) / n);
      const drift = w * between(0.1, 0.3) * size;
      const mote = {
        wait: between(0, MOTE_WAIT_MS),
        life: between(MOTE_MS.min, MOTE_MS.max),
        x: from.x,
        y: from.y,
        dx: from.nx * drift,
        dy: from.ny * drift,
        rise: w * between(0.2, 0.5),
        sway: w * between(0.01, 0.035),
        phase: between(0, TWO_PI),
        scale: (clamp(w * between(0.2, 0.42), 10, 72) * size) / MOTE_PX,
        alpha: between(0.7, 1),
      };
      const white = hit && i % MOTE_HIT_WHITE === 0;
      this.spawn('mote', mote, sprite => {
        sprite.tint = white ? 0xffffff : tint;
      });
    }
  }

  /** `n` square sparks thrown from the edges of `card` — a hit's further, more of them in the whiter tone. */
  sparks(card, color, n, hit) {
    const w = card.width;
    const side = clamp(w * PIXEL_SIDE, PIXEL_SIDE_PX.min, PIXEL_SIDE_PX.max);
    const far = hit ? PIXEL_HIT_REACH : 1;
    const paleEvery = hit ? PIXEL_PALE_EVERY.hit : PIXEL_PALE_EVERY.card;
    const tint = mixNumbers(color, 0xffffff, PIXEL_LIFT);
    const pale = mixNumbers(color, 0xffffff, PIXEL_PALE_LIFT);
    for (let i = 0; i < n; i++) {
      const from = edgeAt(card, (i + Math.random()) / n);
      const lean = between(-PIXEL_FAN, PIXEL_FAN);
      const cos = Math.cos(lean);
      const sin = Math.sin(lean);
      const reach = w * (PIXEL_REACH.min + (PIXEL_REACH.max - PIXEL_REACH.min) * Math.random() ** 2) * far;
      const spark = {
        wait: between(0, 40),
        life: between(PIXEL_MS.min, PIXEL_MS.max),
        x: from.x,
        y: from.y,
        dx: (from.nx * cos - from.ny * sin) * reach,
        dy: (from.nx * sin + from.ny * cos) * reach,
        // Px a ms once it rises; where in a blink it starts, and radians of blinking a ms
        rise: (w * between(0.25, 0.6)) / 1000,
        phase: between(0, TWO_PI),
        rate: between(0.012, 0.03),
        scale: (side * between(PIXEL_SMALLEST, 1)) / PIXEL_CORE,
        alpha: between(0.85, 1),
      };
      const whiter = i % paleEvery === 0;
      this.spawn('pixel', spark, sprite => {
        sprite.tint = whiter ? pale : tint;
      });
    }
  }

  /** A star of light at the top-right corner of `card`: a hit's. */
  glint(card, color) {
    const star = {
      wait: 120,
      life: 620,
      x: card.left + card.width * 0.92,
      y: card.top + card.height * 0.06,
      dx: 0,
      dy: 0,
      turn: 0,
      spin: 0.9,
      scale: clamp(card.width * 0.8, 24, 150) / TWINKLE_PX,
      alpha: 1,
    };
    this.spawn('twinkle', star, sprite => {
      sprite.tint = mixNumbers(color, 0xffffff, 0.85);
    });
  }

  /** One band of light across the face of `card`, starting `delayMs` from now. */
  sheen(card, delayMs = 0) {
    const key = `${Math.round(card.width)}x${Math.round(card.height)}`;
    let texture = this.sheenTextures.get(key);
    if (!texture) {
      texture = bakeSheen(card.width, card.height);
      this.sheenTextures.set(key, texture);
      this.trimSheens(key);
    }
    const sprite = new TilingSprite({texture, width: card.width, height: card.height});
    sprite.position.set(card.left, card.top);
    sprite.blendMode = 'add';
    sprite.alpha = 0;
    this.node.addChild(sprite);
    // Not yet under way while its clock is below nothing
    this.sheens.push({sprite, elapsed: -Math.max(0, delayMs), width: card.width});
  }

  update(deltaMS) {
    if (this.ahead > 0 && --this.ahead === 0) this.textures.beams ??= BAKED.beams();
    for (let i = this.alive.length - 1; i >= 0; i--) {
      const p = this.alive[i];
      if (p.wait > 0) {
        p.wait -= deltaMS;
        continue;
      }
      p.elapsed += deltaMS;
      const t = clamp(p.elapsed / p.life, 0, 1);
      const sprite = p.sprite;
      if (t >= 1) {
        sprite.visible = false;
        this.free[p.kind].push(sprite);
        this.alive.splice(i, 1);
        continue;
      }
      sprite.visible = true;
      MOVES[p.kind](sprite, p, t);
    }
    for (let i = this.sheens.length - 1; i >= 0; i--) {
      const sheen = this.sheens[i];
      sheen.elapsed += deltaMS;
      const t = clamp(sheen.elapsed / SHEEN_MS, 0, 1);
      // Gone with the card it lay on, when that card was let go of first
      if (t >= 1 || sheen.sprite.destroyed) {
        if (!sheen.sprite.destroyed) sheen.sprite.destroy();
        this.sheens.splice(i, 1);
        continue;
      }
      // The band runs from off the card's left edge to off its right
      sheen.sprite.tilePosition.x = sheen.width * (-2.1 + 2 * t);
      sheen.sprite.alpha = SHEEN_ALPHA * Math.sin(Math.PI * t);
    }
  }

  /**
   * No more bands kept than `SHEEN_KEPT`: the oldest go, never the one just
   * baked (`keep`) nor one a band on the stage is drawn from.
   */
  trimSheens(keep) {
    for (const [key, texture] of this.sheenTextures) {
      if (this.sheenTextures.size <= SHEEN_KEPT) return;
      if (key === keep || this.sheens.some(sheen => !sheen.sprite.destroyed && sheen.sprite.texture === texture)) continue;
      texture.destroy(true);
      this.sheenTextures.delete(key);
    }
  }

  /**
   * Nothing alight any more. The bands of sheen stay baked: the next
   * ceremony's cards are most often the size these were, and baking one on
   * the frame a card comes up is the frame that can least afford it.
   */
  clear() {
    for (const p of this.alive) {
      p.sprite.visible = false;
      this.free[p.kind].push(p.sprite);
    }
    this.alive = [];
    for (const sheen of this.sheens) {
      if (!sheen.sprite.destroyed) sheen.sprite.destroy();
    }
    this.sheens = [];
  }

  destroy() {
    this.clear();
    for (const texture of this.sheenTextures.values()) texture.destroy(true);
    this.sheenTextures.clear();
    this.node.destroy({children: true});
    for (const texture of Object.values(this.textures)) texture.destroy(true);
    this.textures = {};
  }
}
