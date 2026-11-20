/**
 * One item of the climb's grid: the pack's back in its own silhouette, the
 * light round that silhouette and a soft bloom behind it, all three in the
 * one colour the scene hands it, eased into over `CYCLE_FADE_MS` so a change
 * never strobes. It turns about its upright axis in perspective, the back
 * printed on both sides, so nothing but the back ever shows while it spins.
 * Told to `settle`, it slows to face the eye and only then takes its colour;
 * told to `turn`, it turns over once more and comes round as its card — the
 * back gives way to the face, and the pack's shape to the card's, on the
 * frame it is edge-on.
 *
 * Light on purpose: up to sixteen share a stage, so an item owns three
 * display objects and no textures. The lights and the faces are the
 * scene's, baked once per size and tinted here.
 */
import {Container, PerspectiveMesh, Sprite} from 'pixi.js';
import {mixNumbers, toNumber} from '../../runtime/color';
import {CYCLE_FADE_MS} from '../shared/colorCycle';
import {clamp, easeInOut, easeOut, projectPoint} from '../shared/geometry';
import {cardSize} from './faces';
import {KICK_STEP_MS} from './kick';
import {KICK_AT, startSpeed} from './reelStart';
import {halfTurnOf} from './strobe';
import {PILLOW, facingLight, pillowGrid} from './pillow';
import {createPillowMesh} from './pillowMesh';
import {SoldStamp} from './soldStamp';

/** Fine enough that the artwork does not bend between vertices at an item's size. */
const MESH_GRID = 8;
/** The pack's own grid: fine enough for its swell to curve, not crease, at the seals. */
const PILLOW_COLS = 12;
const PILLOW_ROWS = 16;
/** How far the eye stands from an item, in item heights: the card's own lens. */
const FOCAL = 3.2;
/** The nearest an item comes to edge-on: a quad with no width has no perspective to solve. */
const EDGE_ON = Math.acos(0.02);
/** How long a start takes when the scene names none, in ms. */
const RAMP_MS = 320;
/**
 * A stop takes as long as this share of a turn: long enough that, wherever
 * the item is when told, a face it can slow down to lies within reach.
 */
export const STOP_TURNS = 0.5;
/**
 * The least a stop runs on, as a share of the way its speed would carry it
 * in the stop's time; the face it stops on is the first past that. At full
 * speed that keeps every stop between a sixth and five sixths of that way —
 * a slowdown, never a lurch forward and never a turn back.
 */
const STOP_LEAD = 1 / 6;
/** Past this share a face is out of a slowdown's reach — only an item that came in slow is that far. */
const STOP_COAST = 0.85;
/** Turning over to the card takes as long as this share of a turn. */
export const TURN_TURNS = 0.5;
const GLOW_ALPHA = 0.95;
const BLOOM_ALPHA = 0.32;
/**
 * How far the light is lifted towards white: a tier's colour on a stage of
 * that same colour — purple on purple — still shows round the card.
 */
const GLOW_LIFT = 0.3;
/** A sold card's artwork, gone dark, and how long it takes to get there. */
const SOLD_TINT = 0x55585f;
const SOLD_MS = 360;
/** How far towards `SOLD_TINT` a sold card dims. */
const SOLD_DIM = 0.55;
/** The white pop of a card's light as its face comes up, and how much it adds to the light behind. */
const POP_MS = 140;
const POP_BLOOM = 1.5;
/** A hit's light swelling out to stay: how long it takes, and how much wider and brighter it ends. */
const HIT_SWELL_MS = 400;
const HIT_BLOOM_SCALE = 0.7;
const HIT_BLOOM_ALPHA = 2.2;
/** And how much larger the light round its outline stands. */
const HIT_GLOW_SCALE = 0.1;
/**
 * A hit counted on a beat of the combo: it swells towards the eye and comes
 * back — how long the whole of it takes, the share of that it takes to
 * swell, how much larger it gets and how much brighter its light.
 */
const PULSE_MS = 370;
const PULSE_UP = 0.54;
const PULSE_SCALE = 0.12;
/** How far the pulse lifts the light round its outline towards white: the light behind a hit is at its brightest already. */
const PULSE_LIGHT = 0.6;
/**
 * A hit trembling before it comes round: how far it rocks, in radians at its
 * hardest, the run of rocks it goes through — one a thirtieth of a second,
 * as the stage's shakes — and how much larger it swells by the end.
 */
const RATTLE_ROCK = (2.4 * Math.PI) / 180;
const RATTLE_ROCKS = [0.75, -0.2, -0.55, 1, -0.85, 0.4, -1, 0.65];
const RATTLE_FROM = 0.3;
const RATTLE_SWELL = 0.04;
/** The bloom's size, in item widths and heights. */
const BLOOM_SCALE_X = 2;
const BLOOM_SCALE_Y = 1.5;
const TWO_PI = Math.PI * 2;

/** A box on the stage as edges around the point (`x`, `y`). */
const around = (box, x, y) => ({
  left: box.left - x,
  top: box.top - y,
  right: box.left + box.width - x,
  bottom: box.top + box.height - y,
});

const grow = (box, by) => ({
  left: box.left - by,
  top: box.top - by,
  right: box.right + by,
  bottom: box.bottom + by,
});

/**
 * How far through its stop an item is at `t` (0..1), and how fast it is
 * getting there — the distance's share per unit of `t`. `k` is the stop's
 * distance against the way the item's speed would carry it in the stop's
 * time: it leaves at that speed and arrives at rest. Up to a half, it brakes
 * harder the shorter the way (speed `(1 - t)^(1/k - 1)`); up to
 * `STOP_COAST`, it coasts longer the longer the way (`1 - t^(k / (1 - k))`)
 * — never faster than it came in, never backwards. Further than that, it
 * came in too slow to coast there and gathers speed first (a Hermite curve,
 * which goes forwards all the way for any `k` past a third).
 */
function stopEase(t, k) {
  if (!Number.isFinite(k)) {
    return [t * t * (3 - 2 * t), 6 * t * (1 - t)];
  }
  if (k <= 0.5) {
    const p = 1 / k;
    return [1 - Math.pow(1 - t, p), p * Math.pow(1 - t, p - 1)];
  }
  if (k <= STOP_COAST) {
    const q = k / (1 - k);
    return [((q + 1) * t - Math.pow(t, q + 1)) / q, ((q + 1) * (1 - Math.pow(t, q))) / q];
  }
  const t2 = t * t;
  const t3 = t2 * t;
  return [(t - 2 * t2 + t3) / k + 3 * t2 - 2 * t3, (1 - 4 * t + 3 * t2) / k + 6 * t - 6 * t2];
}

/** How small the card is the moment its pack bursts off it, and how soon it has punched up to its lift. */
const BURST_FROM = 0.9;
const BURST_PUNCH = 0.2;

/** A card coming up out of its burst pack: a touch small, punching up past its size, settling back. */
function burstLift(t, lift) {
  if (t < BURST_PUNCH) {
    const k = t / BURST_PUNCH;
    return BURST_FROM + (1 + lift - BURST_FROM) * (1 - (1 - k) * (1 - k));
  }
  return 1 + lift * (1 - easeInOut((t - BURST_PUNCH) / (1 - BURST_PUNCH)));
}

export class ClimbItem {
  /**
   * `glowTextures` is the scene's: `texture` the white light round the
   * outline — `around` the whole image when it follows the silhouette, the
   * opaque box when the pixels could not be read — `spread` past it on every
   * side, and `bloom`, the soft light behind.
   */
  constructor(parent, backTexture, glowTextures, options) {
    this.o = options;
    this.backTexture = backTexture;
    this.node = new Container();
    this.node.visible = false;
    parent.addChild(this.node);

    this.bloom = new Sprite(glowTextures.bloom);
    this.bloom.anchor.set(0.5);
    this.bloom.blendMode = 'add';
    this.bloom.alpha = BLOOM_ALPHA;

    this.glow = new PerspectiveMesh({
      texture: glowTextures.texture,
      verticesX: MESH_GRID,
      verticesY: MESH_GRID,
    });
    this.glow.blendMode = 'add';
    this.glow.alpha = GLOW_ALPHA;

    // Its artwork, drawn point by point over the swell of the card inside, the light worked into it (`pillow.js`)
    this.art = createPillowMesh(backTexture, PILLOW_COLS, PILLOW_ROWS);
    this.node.addChild(this.bloom, this.glow, this.art);
    // `SOLD` stamped across its face once it is sold
    this.stamp = new SoldStamp(this.node, options.climb?.font);
    this.stamped = false;
    this.stampAtOnce = false;
    // The grid's points and light, written in place every frame
    this.pillow = null;
    // The artwork's colour before the light on it: the reel's tint, a sold card's dark
    this.artTint = 0xffffff;
    this.glowTextures = glowTextures;

    this.yaw = 0;
    // rad/ms, the way it is turning now
    this.speed = 0;
    this.spinning = false;
    this.wait = 0;
    // Its start: how long it takes to get going, how fast it turns from there, and how long it has been at it
    this.ramp = RAMP_MS;
    this.rate = 1;
    this.spun = 0;
    this.stop = null;
    // Taken once the item is at rest, not before
    this.final = null;
    // Once told to settle its colour is no longer the reel's to change, nor its spin
    this.held = false;
    this.settled = false;
    // Stood edge-on in its spin since the reel last looked
    this.edged = false;
    // The card it turns into — `{texture, aspect}`, the scene's — and the light round it
    this.face = null;
    this.faceGlow = null;
    this.turning = null;
    // Past edge-on: the card is the side that shows
    this.faceUp = false;
    // Turned over and still again
    this.revealed = false;
    // How much larger than its box it is drawn: an item lifts as it turns
    this.lift = 1;
    // Sold: how far it has gone dark (0..1), and the wait before it starts to
    this.soldness = 0;
    this.soldWait = null;
    // The pop of light as its face comes up, in ms since; and a hit's wider light, as far as it has swelled (0..1)
    this.popClock = Infinity;
    this.hit = false;
    this.hitness = 0;
    // Its pulse on a beat of the combo, in ms since
    this.pulseClock = Infinity;
    // Its tremble before it comes round: how long it lasts, how long it has, and where in the run of rocks it began
    this.rattleMs = 0;
    this.rattleClock = Infinity;
    this.rattleFrom = 0;

    this.from = 0xffffff;
    this.to = 0xffffff;
    this.shown = 0xffffff;
    this.fadeClock = CYCLE_FADE_MS;
  }

  setOptions(options) {
    this.o = options;
    this.stamp.setFont(options.climb?.font);
    this.paint();
  }

  /** The scene baked its light again for a new item size. */
  setGlow(glowTextures) {
    this.glowTextures = glowTextures;
    this.bloom.texture = glowTextures.bloom;
    if (this.rect) this.place(this.rect);
  }

  /**
   * Its box on the grid: `rect` is the pack as seen, `rect.image` the whole
   * image round it. The item stands there, unscaled, until moved. The card
   * it turns into fits the same box.
   */
  place(rect) {
    this.rect = rect;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    this.home = {x, y};
    this.size = {width: rect.width, height: rect.height};
    this.backBox = around(rect.image ?? rect, x, y);
    // The pack itself, without the margin of its image: where its sides are
    this.backBody = around(rect, x, y);
    const g = this.glowTextures;
    this.backGlowBox = grow(g.around === 'image' ? this.backBox : around(rect, x, y), g.spread);
    this.fitFace();
    this.moveTo(x, y, 1);
    this.dress();
    this.pose();
  }

  /**
   * The card it will turn into: `texture` cut to the card's shape, `aspect`
   * its width over its height. It stands in the item's box, as large as the
   * box holds it.
   */
  setFace(face) {
    this.face = face;
    this.fitFace();
    this.dress();
  }

  /** The light round the card, `{texture, spread}`, baked for `faceSize`. */
  setFaceGlow(glow) {
    this.faceGlow = glow;
    this.fitFace();
    this.dress();
  }

  fitFace() {
    if (!this.face || !this.size) {
      this.faceSize = null;
      return;
    }
    this.faceSize = cardSize(this.size, this.face.aspect);
    const {width, height} = this.faceSize;
    this.faceBox = {left: -width / 2, top: -height / 2, right: width / 2, bottom: height / 2};
    this.faceGlowBox = grow(this.faceBox, this.faceGlow?.spread ?? 0);
    this.stamp.place(width);
  }

  /** The side that shows: its artwork, its outline and the light round it. */
  dress() {
    const front = this.faceUp && !!this.face;
    this.art.setPillowTexture(front ? this.face.texture : this.backTexture);
    this.bodyBox = front ? this.faceBox : this.backBody;
    // A pack swells over the card inside it; the card, once it shows, is flat
    const width = this.bodyBox ? this.bodyBox.right - this.bodyBox.left : 0;
    this.swell = front ? 0 : PILLOW.height * width;
    this.glow.texture = front && this.faceGlow ? this.faceGlow.texture : this.glowTextures.texture;
    this.imageBox = front ? this.faceBox : this.backBox;
    this.glowBox = front ? this.faceGlowBox : this.backGlowBox;
    this.glow.visible = !front || !!this.faceGlow;
  }

  /** Where its card is on the stage — its pack, before it has one — once it is home and still. */
  bounds() {
    const box = this.face && this.faceBox ? this.faceBox : around(this.rect, this.home.x, this.home.y);
    const left = this.home.x + box.left;
    const top = this.home.y + box.top;
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    return {left, top, right: left + width, bottom: top + height, width, height};
  }

  contains(x, y) {
    if (!this.node.visible || !this.home) return false;
    const b = this.bounds();
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  }

  /** Off its box for a while — the intro flies it in: centred on (`x`, `y`), `scale` times its size. */
  moveTo(x, y, scale) {
    this.node.position.set(x, y);
    this.node.scale.set(scale);
  }

  show() {
    this.node.visible = true;
  }

  hide() {
    this.node.visible = false;
  }

  setAlpha(alpha) {
    this.node.alpha = alpha;
  }

  /**
   * Starts turning `delayMs` from now: barely at first, then all at once
   * (`startSpeed`) over `rampMs`, and from there `rate` times as fast as one
   * turn in `climb.spinMs`. Not once it has been told to settle: a stop is
   * never undone.
   */
  spin(delayMs = 0, rampMs = RAMP_MS, rate = 1) {
    if (this.held) return;
    this.spinning = true;
    this.wait = Math.max(0, delayMs);
    this.ramp = rampMs > 0 ? rampMs : RAMP_MS;
    this.rate = rate > 0 ? rate : 1;
    this.spun = 0;
    this.stop = null;
    this.settled = false;
  }

  /** Taken off: past the slow part of its start, turning fast. */
  get kicked() {
    return this.spinning && this.wait <= 0 && this.spun >= this.ramp * KICK_AT;
  }

  /**
   * The colour it eases into over `CYCLE_FADE_MS` from the one it shows now,
   * or at once.
   */
  setColor(hex, immediate = false) {
    this.ease(toNumber(hex, this.to), immediate);
  }

  ease(color, immediate = false) {
    this.from = immediate ? color : this.shown;
    this.to = color;
    this.fadeClock = immediate ? CYCLE_FADE_MS : 0;
    if (immediate) {
      this.shown = color;
      this.paint();
    }
  }

  /**
   * Slows to rest facing the eye, then takes `hex`: the colour it stops on
   * comes only once it has stopped. A stop always takes `STOP_TURNS` of a
   * turn, so a scene can count on it, and only ever goes forwards: it
   * leaves at the speed the item had and comes to rest on the first face
   * far enough ahead to slow down to (see `stopEase`).
   */
  settle(hex) {
    if (this.held) return;
    // Never a colour the reel happened to show: no colour given is the lowest's, white
    this.final = toNumber(hex, 0xffffff);
    this.held = true;
    this.spinning = false;
    this.wait = 0;
    const duration = Math.max(1, STOP_TURNS * this.o.climb.spinMs);
    const reach = Math.max(0, this.speed) * duration;
    // A hair either side of a face counts as on it
    const distance = Math.PI * Math.ceil((this.yaw + STOP_LEAD * reach) / Math.PI - 1e-6) - this.yaw;
    if (distance < 1e-6) {
      this.speed = 0;
      this.rest();
      return;
    }
    this.stop = {from: this.yaw, distance, duration, elapsed: 0, k: reach > 0 ? distance / reach : Infinity};
  }

  /**
   * Turns over to its card over `durationMs`, rising by `lift` of its size
   * at the middle of the turn; the card takes over from the back on the
   * frame the item is edge-on. One still on its way to rest gets there first.
   */
  turn(durationMs, lift = 0, burst = false) {
    if (this.turning || this.revealed) return;
    this.still();
    const stop = this.stop;
    if (stop) {
      this.stop = null;
      this.yaw = (stop.from + stop.distance) % TWO_PI;
      this.speed = 0;
      this.rest();
    }
    this.spinning = false;
    this.held = true;
    this.turning = {from: this.yaw, duration: Math.max(1, durationMs), elapsed: 0, lift, burst};
  }

  /**
   * The back as it shows now, for a burst (`shatter.js`): its artwork, the
   * box it fills about the item's middle, where the item stands and how
   * large, and the colour and foil it is in.
   */
  backView() {
    return {
      texture: this.backTexture,
      box: this.backBox,
      x: this.node.position.x,
      y: this.node.position.y,
      scale: this.node.scale.x * this.lift,
      color: this.shown,
      flood: clamp(this.o.climb.flood ?? 0, 0, 1) * (1 - this.soldness),
    };
  }

  /**
   * At rest as its card, facing the eye in `hex`'s light, home, whole and
   * still: where a ceremony skipped to its end leaves it. A stop or a turn
   * under way ends there.
   */
  finish(hex) {
    this.spinning = false;
    this.wait = 0;
    this.stop = null;
    this.turning = null;
    this.final = null;
    this.held = true;
    this.settled = true;
    this.yaw = 0;
    this.speed = 0;
    this.lift = 1;
    this.pulseClock = Infinity;
    this.still();
    this.faceUp = !!this.face;
    this.revealed = true;
    this.ease(toNumber(hex, 0xffffff), true);
    this.show();
    this.setAlpha(1);
    if (this.home) this.moveTo(this.home.x, this.home.y, 1);
    this.dress();
    this.pose();
  }

  /** Still, facing the eye, back home and hidden, its card let go: the grid before `start()`. */
  reset() {
    this.stamp.lift();
    this.stamped = false;
    this.yaw = 0;
    this.speed = 0;
    this.spinning = false;
    this.wait = 0;
    this.ramp = RAMP_MS;
    this.rate = 1;
    this.spun = 0;
    this.stop = null;
    this.final = null;
    this.held = false;
    this.settled = false;
    this.edged = false;
    this.turning = null;
    this.face = null;
    this.faceGlow = null;
    this.faceUp = false;
    this.revealed = false;
    this.lift = 1;
    this.soldness = 0;
    this.soldWait = null;
    this.popClock = Infinity;
    this.hit = false;
    this.hitness = 0;
    this.pulseClock = Infinity;
    this.still();
    this.fitFace();
    this.dress();
    this.ease(0xffffff, true);
    this.setAlpha(1);
    if (this.home) this.moveTo(this.home.x, this.home.y, 1);
    this.pose();
    this.hide();
  }

  /**
   * Sold: after `delayMs` of the scene's time it is stamped `SOLD`, its card dims and its light goes out — `atOnce`,
   * stamped already, for a card a skip put up sold. Once is enough.
   */
  setSold(delayMs = 0, atOnce = false) {
    if (this.soldWait !== null || this.soldness > 0) return;
    this.soldWait = Math.max(0, delayMs);
    this.stampAtOnce = atOnce;
  }

  /** Going dark still: the scene is not at rest until it is over. */
  get fading() {
    return this.soldWait !== null && this.soldness < 1;
  }

  /** How far through its pop of light it is: 1 as the face comes up, 0 from `POP_MS` on. */
  get popped() {
    return this.popClock < POP_MS ? 1 - this.popClock / POP_MS : 0;
  }

  /** Its light pops white for a moment: its face has just come up. */
  pop() {
    this.popClock = 0;
  }

  /** A hit: the light behind it swells out and stays wider and brighter — `atOnce` for one put up by a skip. */
  setHit(atOnce = false) {
    this.hit = true;
    if (atOnce) this.hitness = 1;
  }

  /** Counted on a beat of the combo: it swells towards the eye, its light with it, and comes back. */
  pulse() {
    this.pulseClock = 0;
  }

  /** Trembles for `ms` of the wall clock, harder and a little larger as it goes: a hit about to come round. */
  rattle(ms) {
    this.rattleMs = Math.max(1, ms);
    this.rattleClock = 0;
    // Each from its own place in the run: two hits never rock in step
    this.rattleFrom = Math.floor(Math.random() * RATTLE_ROCKS.length);
  }

  /** Its tremble over at once, upright again. */
  still() {
    this.rattleClock = Infinity;
    this.node.rotation = 0;
  }

  /** How far through its pulse it is: up to 1 over the first part of `PULSE_MS`, back to 0 over the rest. */
  get pulsed() {
    if (this.pulseClock >= PULSE_MS) return 0;
    const t = this.pulseClock / PULSE_MS;
    return t < PULSE_UP ? easeOut(t / PULSE_UP) : 1 - easeInOut((t - PULSE_UP) / (1 - PULSE_UP));
  }

  /** Something of its own still moves once it is up — going dark, popping, swelling, pulsing: the scene is not at rest. */
  get animating() {
    return this.fading || this.stamp.moving || this.popClock < POP_MS || this.pulseClock < PULSE_MS || (this.hit && this.hitness < 1);
  }

  /** `deltaMS` of the ceremony's clock on; its pulse runs on the wall clock (`wallMS`), as the beat that struck it. */
  update(deltaMS, wallMS = deltaMS) {
    this.rotate(deltaMS);
    this.fadeClock = Math.min(CYCLE_FADE_MS, this.fadeClock + deltaMS);
    this.shown = mixNumbers(this.from, this.to, this.fadeClock / CYCLE_FADE_MS);
    if (this.fading) {
      if (this.soldWait > 0) this.soldWait -= deltaMS;
      else this.soldness = Math.min(1, this.soldness + deltaMS / SOLD_MS);
    }
    // The stamp comes down as it starts to dim
    if (this.soldWait !== null && this.soldWait <= 0 && !this.stamped) {
      this.stamped = true;
      this.stamp.stamp(this.stampAtOnce);
      // Stamped before the eye, not put up stamped by a skip: a sound may mark it
      if (!this.stampAtOnce) this.stampedNow = true;
    }
    this.stamp.update(wallMS);
    if (this.popClock < POP_MS) this.popClock += deltaMS;
    if (this.hit && this.hitness < 1) this.hitness = Math.min(1, this.hitness + deltaMS / HIT_SWELL_MS);
    if (this.pulseClock < PULSE_MS) this.pulseClock += wallMS;
    if (this.rattleClock < this.rattleMs) {
      this.rattleClock += wallMS;
      if (this.rattleClock >= this.rattleMs) this.still();
    }
    this.paint();
    this.pose();
  }

  rotate(deltaMS) {
    if (this.turning) {
      this.turnOver(deltaMS);
      return;
    }
    const stop = this.stop;
    if (stop) {
      stop.elapsed += deltaMS;
      const t = clamp(stop.elapsed / stop.duration, 0, 1);
      const [done, rate] = stopEase(t, stop.k);
      this.yaw = stop.from + stop.distance * done;
      this.speed = (stop.distance * rate) / stop.duration;
      if (t >= 1) {
        this.stop = null;
        this.speed = 0;
        this.yaw = (stop.from + stop.distance) % TWO_PI;
        this.rest();
      }
      return;
    }
    if (!this.spinning) {
      return;
    }
    let dt = deltaMS;
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait > 0) {
        return;
      }
      dt = -this.wait;
      this.wait = 0;
    }
    const full = (TWO_PI / Math.max(1, this.o.climb.spinMs)) * this.rate;
    this.spun += dt;
    this.speed = full * startSpeed(this.spun, this.ramp);
    const side = halfTurnOf(this.yaw);
    this.yaw = (this.yaw + this.speed * dt) % TWO_PI;
    // Edge-on: where a fresh colour comes in unseen
    if (halfTurnOf(this.yaw) !== side) this.edged = true;
  }

  /** Stamped SOLD before the eye since last asked. */
  takeStamped() {
    const stamped = !!this.stampedNow;
    this.stampedNow = false;
    return stamped;
  }

  /** Stood edge-on since last asked: the reel gives it its next colour then. */
  takeEdge() {
    const edged = this.edged;
    this.edged = false;
    return edged;
  }

  /** Half a turn on from where it rests, the way it spun: the card comes round on the far side. */
  turnOver(deltaMS) {
    const turn = this.turning;
    turn.elapsed += deltaMS;
    const t = clamp(turn.elapsed / turn.duration, 0, 1);
    const half = turn.burst ? 1 : easeInOut(t);
    this.yaw = turn.from + Math.PI * half;
    this.lift = turn.burst ? burstLift(t, turn.lift) : 1 + turn.lift * Math.sin(Math.PI * t);
    if (!this.faceUp && half >= 0.5) {
      this.faceUp = true;
      this.dress();
    }
    if (t >= 1) {
      this.turning = null;
      this.yaw = (turn.from + Math.PI) % TWO_PI;
      this.lift = 1;
      this.revealed = true;
    }
  }

  rest() {
    this.settled = true;
    if (this.final !== null) {
      this.ease(this.final);
      this.final = null;
    }
  }

  /**
   * The light takes the colour whole; the pack's artwork only as far as
   * `climb.tint`, and the card's not at all: it shows as it is.
   */
  paint() {
    const light = mixNumbers(mixNumbers(this.shown, 0xffffff, GLOW_LIFT), 0xffffff, this.popped);
    const pulsed = this.pulsed;
    this.glow.tint = pulsed > 0 ? mixNumbers(light, 0xffffff, PULSE_LIGHT * pulsed) : light;
    this.bloom.tint = light;
    this.glow.alpha = GLOW_ALPHA * (1 - this.soldness);
    // The pack a foil of its colour while it spins and once it rests on its card's; the card as it is
    this.art.setFlood(this.shown, this.faceUp ? 0 : clamp(this.o.climb.flood ?? 0, 0, 1) * (1 - this.soldness));
    const art = this.faceUp ? 0xffffff : mixNumbers(0xffffff, this.shown, clamp(this.o.climb.tint, 0, 1));
    // Dimmed, not blacked out: the stamp across it is what says sold
    this.artTint = this.soldness > 0 ? mixNumbers(art, SOLD_TINT, this.soldness * SOLD_DIM) : art;
  }

  /**
   * The artwork and the light round it turned to `yaw` in perspective. Both
   * sides carry the back, so half a turn on it looks the same again: the
   * side that faces the eye is drawn the right way round, never mirrored —
   * the card too, once it has come round. The bloom narrows and dims as the
   * item turns its edge to the eye.
   */
  pose() {
    if (!this.size) return;
    const facing = this.yaw - Math.PI * Math.round(this.yaw / Math.PI);
    const yaw = clamp(facing, -EDGE_ON, EDGE_ON);
    const focal = FOCAL * this.size.height;
    const pulsed = this.pulsed;
    // Trembling: rocked a step every thirtieth of a second, harder as it goes, and swelling
    let swell = 1;
    if (this.rattleClock < this.rattleMs) {
      const gone = this.rattleClock / this.rattleMs;
      const rock = RATTLE_ROCKS[(this.rattleFrom + Math.floor(this.rattleClock / KICK_STEP_MS)) % RATTLE_ROCKS.length];
      this.node.rotation = RATTLE_ROCK * rock * (RATTLE_FROM + (1 - RATTLE_FROM) * gone);
      swell = 1 + RATTLE_SWELL * gone;
    }
    // Lifted by its turn, by its pulse on a beat of the combo, and by its tremble
    const size = this.lift * (1 + PULSE_SCALE * pulsed) * swell;
    // The pack over the card inside it, seen as it turns, and the light on its swell
    const rise = this.swell ?? 0;
    this.pillow = pillowGrid(
      this.imageBox,
      this.bodyBox ?? this.imageBox,
      yaw,
      focal,
      size,
      rise,
      PILLOW_COLS,
      PILLOW_ROWS,
      this.pillow,
    );
    this.art.writePillow(this.pillow.art, this.pillow.light);
    this.art.tint = mixNumbers(0x000000, this.artTint, facingLight(yaw));
    setQuad(this.glow, this.glowBox, yaw, focal, size * (1 + HIT_GLOW_SCALE * easeInOut(this.hitness)));
    const face = Math.cos(yaw);
    // A hit's light stands wider and brighter once swelled; a face just up pops for a moment; a hit counted swells with its card
    const wide = size * (1 + HIT_BLOOM_SCALE * easeInOut(this.hitness) + 0.4 * this.popped);
    const bright = 1 + HIT_BLOOM_ALPHA * easeInOut(this.hitness) + POP_BLOOM * this.popped;
    this.bloom.width = this.size.width * BLOOM_SCALE_X * (0.55 + 0.45 * face) * wide;
    this.bloom.height = this.size.height * BLOOM_SCALE_Y * wide;
    this.bloom.alpha = Math.min(1, BLOOM_ALPHA * (0.4 + 0.6 * face) * bright) * (1 - this.soldness);
  }

  destroy() {
    const geometries = [this.art.geometry, this.glow.geometry];
    this.node.destroy({children: true});
    for (const geometry of geometries) geometry?.destroy(true);
  }
}

function setQuad(mesh, box, yaw, focal, scale) {
  const tl = projectPoint(box.left * scale, box.top * scale, yaw, 0, focal);
  const tr = projectPoint(box.right * scale, box.top * scale, yaw, 0, focal);
  const br = projectPoint(box.right * scale, box.bottom * scale, yaw, 0, focal);
  const bl = projectPoint(box.left * scale, box.bottom * scale, yaw, 0, focal);
  mesh.setCorners(tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
}
