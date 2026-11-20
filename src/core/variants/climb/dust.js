/**
 * The dust behind the climb's stage: small square motes, most of them white
 * and the rest in the reel's colours, coming up from under the stage all the
 * time — the near ones larger, brighter and quicker than the far ones. Each
 * climbs as high as it gets, shrinks and goes out over the last of its way,
 * and comes back in at the bottom somewhere else: the foot of the stage is
 * thick with them, and its top takes only the few that climb all the way.
 * When the stage is shaken they are shaken with it, the far ones less than
 * the near — so it is the whole world that takes the blow, not the cards
 * alone. They never tell anything about the pull.
 *
 * Drawn under everything else on the stage. Its clock is the wall clock: the
 * dust rises at its own pace however the ceremony is hurried, and goes on
 * rising when the ceremony is over.
 */
import {Container, Sprite, Texture} from 'pixi.js';
import {clamp} from '../shared/geometry';

/**
 * How many motes a stage of `STAGE_AREA` css px² carries. A larger stage
 * carries more and a smaller one fewer, by its area; none carries more than
 * `MAX_MOTES`.
 */
const MOTES_PER_STAGE = 100;
const STAGE_AREA = 390 * 844;
const MAX_MOTES = 110;
/**
 * How near a mote is — 0 the farthest, 1 the nearest — is drawn once for
 * each: the higher `DEPTH_SKEW`, the fewer are near. What the farthest and
 * the nearest are: a side in css px, a rise in css px a second, how bright.
 * The rise and the brightness grow evenly with the nearness; the side grows
 * as its `SIDE_CURVE`th power, so only the very nearest are large.
 */
const DEPTH_SKEW = 1.5;
const SIDE = {far: 1.8, near: 4.6};
const SIDE_CURVE = 2;
const RISE = {far: 12, near: 40};
const ALPHA = {far: 0.5, near: 1};
/** How far a mote's rise may be off its depth's, either way: no two keep step. */
const RISE_PLAY = 0.2;
/**
 * The share of the stage's throw the dust takes when the stage is shaken:
 * the motes are shaken as so many depths, the farthest first.
 */
const SHAKE = [0.4, 0.65, 0.9];
/**
 * How high a mote climbs before it is gone, as a share of the stage's
 * height: `REACH.min` at the least and the top of the stage at the most,
 * most of them nearer the least. Past `FADE_FROM` of its climb it goes out,
 * shrinking to `SHRINK` of its side.
 */
const REACH = {min: 0.55, max: 1};
const FADE_FROM = 0.7;
const SHRINK = 0.45;
/** The sway from side to side: how far, in css px, and how long one swing takes, in s. */
const SWAY = {far: 1.5, near: 6};
const SWAY_S = {min: 5, max: 11};
/** The twinkle: the share of its brightness a mote gives up at its dimmest, and how long one takes, in s. */
const TWINKLE = 0.35;
const TWINKLE_S = {min: 2.2, max: 5.5};
/** The share of the motes that are white whatever the colours; the rest take the colours, evenly. */
const WHITE_SHARE = 0.7;
const WHITE = 0xffffff;
/**
 * How long a mote takes to come up out of nothing where it stands — on a
 * stage just laid out, or grown — and to go out when the stage has shrunk
 * and carries fewer, in ms.
 */
const APPEAR_MS = 600;
/**
 * The one texture every mote is drawn from: a white square `MOTE_CORE` px a
 * side with a clear px round it. The clear px and the smaller copies kept of
 * it (mipmaps) are what lets a mote stand between two pixels of the screen —
 * it rises a fraction of a pixel a frame — without its edge crawling.
 */
const MOTE_CORE = 14;

const TWO_PI = Math.PI * 2;
/** What a mote `depth` near has of a figure given for the farthest and the nearest. */
const atDepth = (range, depth) => range.far + (range.near - range.far) * depth;
const between = (range, random) => range.min + (range.max - range.min) * random();

/** How many motes a stage `width` × `height` css px carries. */
export function moteCount(width, height) {
  if (!(width > 0) || !(height > 0)) return 0;
  return Math.min(MAX_MOTES, Math.round((MOTES_PER_STAGE * width * height) / STAGE_AREA));
}

/** Which of the depths shaken as one a mote `depth` near is in, the farthest 0. */
export const layerOf = depth => Math.min(SHAKE.length - 1, Math.floor(depth * SHAKE.length));

/** The share of the stage's throw a mote `depth` near takes. */
export const shakeOf = depth => SHAKE[layerOf(depth)];

/** The colour a mote takes from `colors` by its own draw `pick` (0..1): white, or one of them. */
export function tintOf(colors, pick) {
  if (pick < WHITE_SHARE || !colors.length) return WHITE;
  const share = (pick - WHITE_SHARE) / (1 - WHITE_SHARE);
  return colors[Math.min(colors.length - 1, Math.floor(share * colors.length))];
}

/**
 * How much of a mote is left, `up` the stage on a climb that ends at
 * `reach`: all of it until `FADE_FROM` of the climb, nothing at its end.
 */
export const leftOf = (up, reach) => clamp((1 - up / reach) / (1 - FADE_FROM), 0, 1);

/**
 * A mote, drawn with `random` (0..1): how near it is and what follows from
 * that, how high it climbs, a sway and a twinkle of its own, its draw among
 * the colours — and a place somewhere along its climb, so a stage just laid
 * out is as full as one that has stood for a minute.
 */
export function makeMote(random = Math.random) {
  const depth = Math.pow(random(), DEPTH_SKEW);
  const reach = REACH.min + (REACH.max - REACH.min) * Math.pow(random(), 2);
  return {
    depth,
    side: atDepth(SIDE, Math.pow(depth, SIDE_CURVE)),
    rise: atDepth(RISE, depth) * (1 + (random() * 2 - 1) * RISE_PLAY),
    alpha: atDepth(ALPHA, depth),
    reach,
    // Where it is, as shares of the stage: across from its left edge, and up from its bottom
    across: random(),
    up: random() * reach,
    sway: atDepth(SWAY, depth),
    swayRate: TWO_PI / between(SWAY_S, random),
    swayAt: random() * TWO_PI,
    twinkleRate: TWO_PI / between(TWINKLE_S, random),
    twinkleAt: random() * TWO_PI,
    pick: random(),
    // How much of it has come up out of nothing, 0..1; and whether it is on its way out for good
    shown: 0,
    going: false,
  };
}

/**
 * `mote` `seconds` further up a stage `height` css px high. One at the end
 * of its climb — the top of the stage, for those that get there — comes back
 * in from under the bottom edge at another place across, drawn with `random`.
 */
export function riseMote(mote, seconds, height, random = Math.random) {
  mote.up += (mote.rise * seconds) / height;
  if (mote.up < mote.reach) return;
  mote.across = random();
  mote.up = -mote.side / height;
}

/** The white square, soft at its very edge. */
function bakeMote() {
  const canvas = document.createElement('canvas');
  canvas.width = MOTE_CORE + 2;
  canvas.height = MOTE_CORE + 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(1, 1, MOTE_CORE, MOTE_CORE);
  return Texture.from({resource: canvas, autoGenerateMipmaps: true});
}

export class StarDust {
  /** Its layer goes into `parent`; the scene adds it first, so it lies under the items. */
  constructor(parent) {
    this.node = new Container();
    parent.addChild(this.node);
    // One layer for each depth shaken as one, the farthest lowest
    this.layers = SHAKE.map(() => this.node.addChild(new Container()));
    this.on = true;
    this.width = 0;
    this.height = 0;
    this.colors = [WHITE];
    // Each as `makeMote` drew it, with the `sprite` it is drawn by
    this.motes = [];
    // Baked for the first mote: a stage with its dust off never asks for it
    this.texture = null;
    // s of the wall clock the dust has risen for: what the sway and the twinkle go by
    this.clock = 0;
  }

  /** Something to draw: on, and laid out on a stage with a size. */
  get live() {
    return this.on && this.width > 0 && this.height > 0;
  }

  /** On or off (`climb.dust`): off, nothing is drawn and nothing moves. */
  setOn(on) {
    this.on = !!on;
    this.node.visible = this.on;
    this.settle();
  }

  /** The colours the motes take, as numbers — the reel's palette; white joins them. */
  setColors(colors) {
    this.colors = colors?.length ? colors.slice() : [WHITE];
    for (const mote of this.motes) mote.sprite.tint = tintOf(this.colors, mote.pick);
  }

  /**
   * The stage is `width` × `height` css px: the dust covers all of it. Every
   * mote keeps its place as a share of the stage, so a stage resized is the
   * same dust on another scale.
   */
  layout(width, height) {
    this.width = width;
    this.height = height;
    this.settle();
  }

  /**
   * As many motes as the stage carries, each drawn where it stands: the ones
   * there stay, new ones come up out of nothing, and those past the count go
   * out — or stay after all, when the stage has grown again before they were
   * gone. Off, everything is left as it is.
   */
  settle() {
    if (!this.live) return;
    const count = moteCount(this.width, this.height);
    while (this.motes.length < count) this.motes.push(this.make());
    for (let i = 0; i < this.motes.length; i++) this.motes[i].going = i >= count;
    this.update(0);
  }

  /** One more mote, on the layer of its depth. */
  make() {
    this.texture ??= bakeMote();
    const mote = makeMote();
    const sprite = new Sprite(this.texture);
    sprite.anchor.set(0.5);
    sprite.tint = tintOf(this.colors, mote.pick);
    this.layers[layerOf(mote.depth)].addChild(sprite);
    return {...mote, sprite};
  }

  /**
   * `deltaMS` of the wall clock on: every mote rises, swaying and twinkling
   * as it goes, and one at the end of its climb comes back in at the bottom.
   */
  update(deltaMS) {
    if (!this.live) return;
    const {width, height, motes} = this;
    const seconds = deltaMS / 1000;
    const appear = deltaMS / APPEAR_MS;
    this.clock += seconds;
    // Backwards, so one that has gone out for good can be dropped on the way
    for (let i = motes.length - 1; i >= 0; i--) {
      const mote = motes[i];
      const sprite = mote.sprite;
      mote.shown = clamp(mote.shown + (mote.going ? -appear : appear), 0, 1);
      if (mote.going && mote.shown === 0) {
        sprite.destroy();
        motes.splice(i, 1);
        continue;
      }
      riseMote(mote, seconds, height);
      const left = leftOf(mote.up, mote.reach);
      const dim = TWINKLE * (0.5 + 0.5 * Math.sin(this.clock * mote.twinkleRate + mote.twinkleAt));
      sprite.position.set(
        mote.across * width + mote.sway * Math.sin(this.clock * mote.swayRate + mote.swayAt),
        height * (1 - mote.up),
      );
      sprite.scale.set((mote.side * (SHRINK + (1 - SHRINK) * left)) / MOTE_CORE);
      sprite.alpha = mote.alpha * left * mote.shown * (1 - dim);
    }
  }

  /** The stage stands (`x`, `y`) px off its centre now: the dust goes with it, the far motes less than the near. */
  shake(x, y) {
    if (!this.live) return;
    for (let i = 0; i < SHAKE.length; i++) this.layers[i].position.set(x * SHAKE[i], y * SHAKE[i]);
  }

  /** Nothing of it left, the texture included; `update` and `shake` after this do nothing. */
  destroy() {
    this.on = false;
    this.motes = [];
    this.node.destroy({children: true});
    this.texture?.destroy(true);
    this.texture = null;
  }
}
