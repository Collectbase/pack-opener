/**
 * Pixi scene for the `climb` mechanic ("Rarity Climb"): the whole purchase on
 * one stage, a grid of as many items as there are packs, each the pack's own
 * artwork in its own silhouette.
 *
 * Nothing shows until `start()`. Then one item flies in from the centre and
 * splits into the grid, and the reel runs: every item starts to turn at a
 * moment of its own — slowly, then all at once — spins at a speed of its own
 * and glows in colours of its own, changed at moments of its own — never one
 * colour for all, and nothing in them about the pull. Once the
 * cards are in (`setCards`) and the reel has run its shortest, the reveal
 * takes over (`RevealSequence`): the items stop one by one in grid order,
 * each taking its card's colour only as it comes to rest; the ordinary ones
 * turn over into their cards in grid order, a price over the top edge of each;
 * the hits wait, then turn together under a flash; the combo, if there is
 * one, is written under the grid. A tap on a card after that is the host's
 * to answer.
 *
 * The stage is shaken at the blows of it (`kick.js`): the pack coming down
 * and bursting into the grid, the first card landing on its face, the hits
 * coming round and landing, every beat of the combo, and a sum reaching the
 * balance on the host's word. The cards and what they throw off move as one;
 * what is written stays where it is, so a card slides under its own price.
 *
 * `setSpeed` hurries the spin alone — the reel and the items coming to rest
 * one by one (`HURRIED`); the fly-in, the turns, the hits, the combo, the
 * prices and the gather always run at their own pace. `skipToEnd` lands it
 * on its end.
 *
 * Like every variant it knows nothing about where it runs. It draws, and it
 * reports what happened via `emit`.
 */
import {Container, Sprite} from 'pixi.js';
import {MESSAGES} from '../../config/protocol';
import {toNumber} from '../../runtime/color';
import {ScreenFlash} from '../shared/blast';
import {clamp, easeInOut, easeOut} from '../shared/geometry';
import {
  contentBoundsOf,
  makeBloomTexture,
  makeHaloTexture,
  makeSilhouetteGlowTexture,
  makeTwinkleTexture,
} from '../shared/textures';
import {comboIndices} from './combo';
import {ComboBanner} from './comboBanner';
import {StarDust} from './dust';
import {CardFaces, PENDING} from './faces';
import {gridRects, labelRoomOf} from './grid';
import {ClimbItem, TURN_TURNS} from './item';
import {KICKS, peakOf, StageKick} from './kick';
import {HAZE, HitAuras} from './hitAura';
import {GATHER, gatherDelays} from './priceMotion';
import {PricePop} from './pricePop';
import {LABEL_MIN_PX, LABEL_ROOM, PriceLabel} from './priceLabel';
import {reelLengthMs, reelStarts} from './reelStart';
import {ReelColors} from './reelColors';
import {RevealFx} from './revealFx';
import {RevealSequence} from './sequence';
import {Shatter} from './shatter';

/** Kept clear round the grid, as a share of the free band's width and height. */
const MARGIN_X = 0.04;
const MARGIN_Y = 0.02;
/** Space between neighbours, in item widths: room for their glows to fade before they meet. */
const GAP = 0.14;
/** How far the light reaches past an item's outline, in item widths. */
const GLOW_SPREAD = 0.14;
/**
 * The line kept under the grid for the combo: a share of the free band's
 * height, and its least and most in css px. Kept whether a combo comes or
 * not — room made only for one would give the hits away before they stop.
 */
const COMBO_ROOM = 0.08;
const COMBO_ROOM_MIN = 28;
const COMBO_ROOM_MAX = 72;
/** The share of the intro the one item takes to fly in; the split takes the rest. */
const ARRIVE = 0.4;
/** How small the arriving item starts, against its full size. */
const ARRIVE_FROM = 0.35;
/** The most the split holds one item back behind the one before, as a share of the split. */
const SPLIT_STEP = 0.06;
/**
 * The most of the reel's shortest run the items' starts may take up: the
 * last to start is still well under way when the first is told to stop.
 */
const START_ROOM = 0.35;
/**
 * The flash as the hits come round: how long, in ms of the wall clock as the
 * shake under it, how bright, and the share of it the screen stays white.
 */
const FLASH_MS = 420;
const FLASH_ALPHA = 1;
const FLASH_HOLD = 0.18;
/** Where the prices gather when the host names no place: this share of the band it keeps over the grid, from the stage's top. */
const GATHER_Y = 0.62;
/** The side of the star the prices' twinkles are drawn from, in px. */
const STAR_PX = 64;
/** How long after a card lands the band of sheen starts across it, in ms: the price first, then its stars, then the sheen. */
const SHEEN_AFTER_MS = 230;
/**
 * The cards on show whisked away as the next ceremony begins: how long, in
 * ms of the wall clock, and how small they are by the time they are gone.
 */
const WHISK_MS = 230;
const WHISK_TO = 0.5;
const WHITE = {rim: 0xffffff};
/**
 * The shakes (`KICKS`) are drawn for a stage `KICK_STAGE` css px wide and
 * grow with the stage, within `KICK_SCALE`. A card alone lands the harder the
 * higher its tier stands: `LONE_GAIN_TOP` times as hard at the top of the
 * palette as at the bottom.
 */
const KICK_STAGE = 390;
const KICK_SCALE = {min: 0.8, max: 1.6};
const LONE_GAIN_TOP = 1.6;
/**
 * The combo counts the hits out: one beat for each, `COMBO_BEAT_MS` of the
 * wall clock apart — the stage thumped, that hit pulsed, the words
 * starting — and no more than `COMBO_BEATS_MAX` of them. On the wall clock,
 * as the thump is: hurried with the ceremony the beats would run into one.
 */
const COMBO_BEAT_MS = 233;
const COMBO_BEATS_MAX = 6;
/** How far a finger may wander and still have tapped, in css px. */
const TAP_SLOP = 12;
/** One frame at full rate. */
const FRAME_MS = 1000 / 60;
/** The most of the wall clock the dust is moved on in one frame: a stage waking from its sleep does not jump it. */
const DUST_FRAME_MS = 100;

/** A whole number of items, one at least. */
const countOf = options => Math.max(1, Math.round(options.climb.count) || 1);

/** The box round every item's. */
function boundsOf(rects) {
  if (rects.length === 0) return {left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0};
  const left = Math.min(...rects.map(r => r.left));
  const top = Math.min(...rects.map(r => r.top));
  const right = Math.max(...rects.map(r => r.right));
  const bottom = Math.max(...rects.map(r => r.bottom));
  return {left, top, right, bottom, width: right - left, height: bottom - top};
}

/**
 * A host's card as the scene keeps it — its artwork goes to `CardFaces`: a
 * colour, a hit or not, a price or none, its tier's name or none, and
 * whether it is sold already.
 */
const cardOf = entry => ({
  color: entry?.color,
  hit: !!entry?.hit,
  price: typeof entry?.price === 'number' && Number.isFinite(entry.price) ? entry.price : null,
  tier: typeof entry?.tier === 'string' && entry.tier.trim() ? entry.tier.trim() : null,
  sold: !!entry?.sold,
  combo: !!entry?.combo,
});

/**
 * The reel's moments for sound: a pulse every so often, in ms of the ceremony's time — the first this long in, then
 * from `PULSE_MS.from` apart at the start of the reel to `PULSE_MS.to` at its end — and the riser told this many ms of
 * the wall clock before the items stop (none when less than `RISER_MS.least` is left).
 */
const PULSE_MS = {first: 300, from: 850, to: 380};
const RISER_MS = {lead: 1600, least: 300};

/** The phases `setSpeed` hurries: the reel, and the items coming to rest one by one. The rest runs at 1×. */
const HURRIED = new Set(['reel', 'settle']);

export class ClimbScene {
  constructor(app, texture, options, emit) {
    this.app = app;
    this.texture = texture;
    this.emit = emit || (() => {});
    this.o = options;
    this.enabled = true;
    // Where the ceremony is: null before `start()`, then 'intro', 'reel',
    // 'settle', 'turn', 'hits', 'finale' and 'done'
    this.phase = null;
    // Who began it: 'start', the host's word, or 'cards' that found nothing waiting
    this.openedBy = null;
    // ms of the scene's own time since the ceremony began, `speed` of them to every ms
    this.clock = 0;
    this.speed = 1;
    // The first frame after a ceremony begins: a ticker woken from sleep hands it the whole nap
    this.fresh = false;
    // A new layout that arrived mid-ceremony, for when it is over
    this.pendingLayout = false;
    // This ceremony's cards once the host has them, in grid order, and its combo;
    // their artwork and the faces baked from it are `cardFaces`'
    this.cards = null;
    this.combo = null;
    this.cardFaces = new CardFaces(app.renderer);
    // The reveal, from the stops on
    this.sequence = null;
    // The end, asked for before the cards came
    this.skipWanted = false;
    // Items moving to a grid for another count, and the ones fading off it
    this.relay = null;
    this.leaving = [];
    this.press = null;
    this.flashClock = Infinity;

    this.root = new Container();
    app.stage.addChild(this.root);
    // Behind everything: the dust, rising all the time and shaken with the stage
    this.dust = new StarDust(this.root);
    // What a blow to the stage shakes: the items and what they throw off, as one
    this.shaken = new Container();
    // Under the items: the cards of the ceremony before, on their way out
    this.ghostLayer = new Container();
    this.shaken.addChild(this.ghostLayer);
    this.ghosts = [];
    // Under the cards: the rays the hits stand in; at the back of the stage, its haze
    this.auras = new HitAuras(this.shaken, this.root, 0);
    this.itemLayer = new Container();
    this.shaken.addChild(this.itemLayer);
    // Over the cards: the pieces of packs bursting off them
    this.shatter = new Shatter(this.shaken);
    // What a card throws off flies over the cards and under what is written
    this.fx = new RevealFx(this.shaken);
    this.root.addChild(this.shaken);
    // What is written stands still while the cards shake under it. Over every
    // item, so no neighbour's light washes a price out
    this.labelLayer = new Container();
    this.root.addChild(this.labelLayer);
    // The large prices over the cards' top edges, and their flight into the total
    this.popLayer = new Container();
    this.root.addChild(this.popLayer);
    this.banner = new ComboBanner(this.root, options.climb.font);
    // The flash covers the stage whole: it does not shake with it
    this.flash = new ScreenFlash(this.root);
    this.kick = new StageKick();
    // The cards whose face has come up, by index: each throws its shards once
    this.faced = [];
    // The blows a ceremony gives once: the pack bursting into the grid, the
    // first ordinary card landing, the hits landing
    this.struck = {burst: false, landed: false, hitsLanded: false};
    // The combo counting the hits out: which is next, and how long until it
    this.beats = null;
    // The items whose take-off has been told this ceremony
    this.spunUp = [];

    // Laid out by the pack as seen, not by the margins of its image
    this.content = contentBoundsOf(texture);
    const c = this.content;
    this.aspect = (texture.width * (c.right - c.left)) / (texture.height * (c.bottom - c.top));

    this.items = [];
    this.labels = [];
    this.pops = [];
    // The star every price's twinkles are drawn from
    this.star = makeTwinkleTexture(STAR_PX);
    // The prices gathering into the total: the wait before they leave, and whether they have
    this.gather = null;
    // This frame's share of the wall clock
    this.wall = 0;
    this.reelColors = new ReelColors();
    this.rects = [];
    this.glow = null;
    this.glowKey = '';
    this.rect = {left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0};
    const count = countOf(options);
    this.bakeGlow(this.gridFor(count)[0]);
    this.setCount(count);
    this.layout();
  }

  /**
   * Still until `start()`, and again once every card is up and no sold card
   * is still going dark; everything moves in between.
   */
  get activity() {
    if (this.phase && this.phase !== 'done') return 'busy';
    const moving =
      this.kick.live ||
      this.fx.live ||
      this.shatter.live ||
      this.auras.live ||
      this.ghosts.length > 0 ||
      this.items.some(item => item.animating);
    if (this.phase && moving) return 'busy';
    // Nothing but the dust rising: drawn at the rate of a stage that only hints
    return this.dust.live ? 'hint' : 'idle';
  }

  /**
   * A ceremony `start()` began that can still take its cards: cards sent now
   * are that ceremony's, and a later `start()` leaves them behind with it.
   */
  get awaitingCards() {
    return this.openedBy === 'start' && (this.phase === 'intro' || this.phase === 'reel');
  }

  /** The tallest a card is drawn, in css px: an item alone is the largest any grid has, and its card fits inside it. */
  get cardHeight() {
    return this.lone?.height ?? 0;
  }

  /* ── layout ── */

  /**
   * The band the grid has (`layout.stage`, less a margin) and the room kept
   * for the combo under it.
   */
  bandOf() {
    const {width, height} = this.app.screen;
    const stage = this.o.layout.stage;
    const free = Math.max(1, height - stage.reserveTop - stage.reserveBottom);
    const room = clamp(free * COMBO_ROOM, COMBO_ROOM_MIN, COMBO_ROOM_MAX);
    return {
      free,
      room,
      band: {
        left: width * MARGIN_X,
        top: stage.reserveTop + free * MARGIN_Y,
        width: width * (1 - 2 * MARGIN_X),
        height: Math.max(1, free * (1 - 2 * MARGIN_Y) - room),
      },
    };
  }

  /**
   * Boxes for `count` items in the band the host left free, less a margin
   * and the combo's line, in the columns that show them largest, with room
   * under each for its price and tier. No item outgrows the pack `slice`
   * shows alone (`layout.pack`), so more items only ever shrink. Each box is
   * the pack as seen; its `image` is the whole image round it.
   */
  gridFor(count) {
    const {width} = this.app.screen;
    const {free, band} = this.bandOf();
    const pack = this.o.layout.pack;
    const lone = Math.min(width * pack.widthRatio, free * pack.heightRatio * this.aspect);
    const c = this.content;
    const labels = {label: LABEL_ROOM, labelMin: LABEL_MIN_PX};
    return gridRects(count, band, this.aspect, {gap: GAP, ...labels, maxWidth: lone}).map(r => {
      const w = r.width / (c.right - c.left);
      const h = r.height / (c.bottom - c.top);
      return {...r, image: {left: r.left - c.left * w, top: r.top - c.top * h, width: w, height: h}};
    });
  }

  /**
   * The light round an item, baked white for the size items have now and
   * shared by all of them: round the pack's own outline when its pixels can
   * be read, round its box otherwise.
   */
  bakeGlow(rect) {
    if (!rect) return;
    const key = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
    if (this.glow && key === this.glowKey) return;
    const spread = Math.max(4, Math.round(rect.width * GLOW_SPREAD));
    const outline = makeSilhouetteGlowTexture(this.texture, rect.image.width, rect.image.height, spread);
    const before = this.glow;
    this.glow = {
      texture:
        outline ??
        makeHaloTexture(
          rect.width,
          rect.height,
          '#ffffff',
          spread,
          Math.min(rect.width, rect.height) * 0.04,
        ),
      around: outline ? 'image' : 'content',
      spread,
      bloom: before?.bloom ?? makeBloomTexture(256, '#ffffff'),
    };
    this.glowKey = key;
    for (const item of this.items) item.setGlow(this.glow);
    for (const {item} of this.leaving) item.setGlow(this.glow);
    before?.texture.destroy(true);
  }

  /** As many items as `count`: the ones there stay, the rest come or go at once. */
  setCount(count) {
    while (this.items.length > count) {
      this.items.pop().destroy();
      this.labels.pop().destroy();
      this.pops.pop().destroy();
    }
    while (this.items.length < count) {
      this.items.push(new ClimbItem(this.itemLayer, this.texture, this.glow, this.o));
      this.labels.push(new PriceLabel(this.labelLayer, this.o.climb.font));
      this.pops.push(new PricePop(this.popLayer, this.o.climb.font, this.star));
    }
  }

  layout() {
    this.rects = this.gridFor(this.items.length);
    this.lone = this.gridFor(1)[0];
    this.bakeGlow(this.rects[0]);
    this.items.forEach((item, i) => item.place(this.rects[i]));
    this.rect = boundsOf(this.rects);
    // Whose colours each item keeps clear of
    this.reelColors.layout(this.rects);
    this.lightFaces();
    this.labels.forEach((label, i) => label.place(this.items[i].bounds()));
    this.pops.forEach((pop, i) => pop.place(this.items[i].bounds()));
    const {room, band} = this.bandOf();
    // Under the last row's prices and tiers, in the room kept for it
    const written = this.rects[0] ? labelRoomOf(this.rects[0].width, LABEL_ROOM, LABEL_MIN_PX) : 0;
    this.banner.place(band.left + band.width / 2, this.rect.bottom + written + room / 2, band.width, room);
    this.flash.layout(this.app.screen);
    this.auras.layout(this.app.screen);
    this.tuneDust();
    this.dust.layout(this.app.screen.width, this.app.screen.height);
    // Faces still to turn are baked again ahead, for the size the items have now
    if (this.cards) this.cardFaces.rebake(this.items.map((item, i) => (item.face ? -1 : i)).filter(i => i >= 0));
  }

  /** The dust as the options have it now: on or off, and in the reel's colours. */
  tuneDust() {
    this.dust.setOn(this.o.climb.dust !== false);
    this.dust.setColors(this.palette().map(color => toNumber(color, 0xffffff)));
  }

  relayout() {
    this.layout();
    this.emit(MESSAGES.LAYOUT, {rect: this.rect});
  }

  /**
   * The light round each card, for the size it is now, and round each face
   * baked ahead; lights no card has any more go.
   */
  lightFaces() {
    const keys = new Set();
    this.items.forEach((item, i) => {
      const glow = item.face ? this.lightFace(item) : this.cardFaces.glowOf(i);
      if (glow) keys.add(glow.key);
    });
    this.cardFaces.keep(keys);
  }

  lightFace(item) {
    if (!item.faceSize) return null;
    const glow = this.cardFaces.light(item.faceSize, this.glow.spread, this.o.theme.cornerRadius);
    item.setFaceGlow(glow);
    return glow;
  }

  /** What a card is drawn by, as `CardFaces` wants it. */
  faceLook() {
    return {theme: this.o.theme, card: this.o.layout.card, spread: this.glow.spread};
  }

  /* ── host ── */

  /** Every card is up — its price may still be counting, the combo still landing: a tap on one is the host's. */
  get tappable() {
    return this.enabled && (this.phase === 'finale' || this.phase === 'gather' || this.phase === 'done');
  }

  /** A tap on a card, once every card is up: the host is told which. */
  onDown(x, y) {
    this.press = null;
    if (!this.tappable) return;
    const index = this.items.findIndex(item => item.contains(x, y));
    if (index >= 0) this.press = {index, x, y};
  }

  onMove(x, y) {
    const press = this.press;
    if (press && Math.hypot(x - press.x, y - press.y) > TAP_SLOP) this.press = null;
  }

  onUp() {
    const press = this.press;
    this.press = null;
    if (press && this.tappable) {
      this.emit(MESSAGES.CARD_TAP, {index: press.index});
    }
  }

  /** The press was taken away rather than let go of: no tap. */
  onCancel() {
    this.press = null;
  }

  // No gesture opens a climb, so there is none to stand in for
  autoSlice() {}

  setEnabled(value) {
    this.enabled = !!value;
    if (!this.enabled) this.press = null;
  }

  // Cards bring their own artwork (`setCards`), and the climb has no stand
  setCardTexture() {}
  setPedestalTexture() {}

  /**
   * Colours, tint and the pace apply at once. A new layout re-lays the grid
   * at once while the scene is at rest — nothing started, or every card up
   * — and, arriving mid-ceremony, the moment it is over. A new count re-lays
   * an idle grid at once; once a ceremony has begun it waits for `reset()`
   * or the next `start()`.
   */
  setOptions(next) {
    const before = this.o;
    this.o = next;
    for (const item of this.items) item.setOptions(next);
    for (const {item} of this.leaving) item.setOptions(next);
    for (const label of this.labels) label.setFont(next.climb.font);
    for (const pop of this.pops) pop.setFont(next.climb.font);
    this.banner.setFont(next.climb.font);
    // Its switch and its colours apply at once, whether the grid is laid out again or not
    this.tuneDust();
    const recount = countOf(next) !== countOf(before);
    const relaid = JSON.stringify(before.layout) !== JSON.stringify(next.layout);
    if (!recount && !relaid) return true;
    if (!this.phase) {
      this.setCount(countOf(next));
      this.relayout();
      return true;
    }
    if (this.phase === 'done') {
      if (relaid) this.relayout();
      return !recount;
    }
    if (relaid) this.pendingLayout = true;
    return false;
  }

  resize() {
    this.relayout();
  }

  /** Back to the empty grid at 1×, the cards let go of, with whatever waited for it applied. */
  reset() {
    this.speed = 1;
    this.clear(countOf(this.o));
  }

  /** Back to an empty grid of `count`: no ceremony, no cards, nothing on show. */
  clear(count) {
    this.phase = null;
    this.openedBy = null;
    this.clock = 0;
    this.fresh = false;
    this.sequence = null;
    this.skipWanted = false;
    this.relay = null;
    this.press = null;
    for (const {item} of this.leaving) item.destroy();
    this.leaving = [];
    this.dropGhosts();
    this.flashClock = Infinity;
    this.flash.clear();
    this.banner.hide();
    for (const label of this.labels) label.hide();
    for (const pop of this.pops) pop.hide();
    this.gather = null;
    // Items let go of their cards before the cards go
    for (const item of this.items) item.reset();
    this.dropCards();
    if (this.pendingLayout || count !== this.items.length) {
      this.pendingLayout = false;
      this.setCount(count);
      this.relayout();
    }
    this.reelColors.reset();
    this.fx.clear();
    this.shatter.clear();
    this.auras.fade();
    this.kick.clear();
    this.shaken.position.set(0, 0);
    this.faced = [];
    this.struck = {burst: false, landed: false, hitsLanded: false};
    this.beats = null;
    this.spunUp = [];
  }

  /**
   * Lets go of the cards and of everything baked from them — their artwork
   * too: the host handed it over for the scene to free. No item may still
   * show one of them.
   */
  dropCards() {
    this.cardsToken = null;
    this.cardFaces.drop();
    this.cards = null;
    this.combo = null;
  }

  /**
   * The ceremony from the top: one item flies in from the centre and splits
   * into the grid — alone, it simply grows in — and then the reel spins until
   * the cards are in, every item in a colour of its own from the first frame.
   * Cards that came a moment before are not lost to it: a ceremony they
   * began and that is still spinning is the one asked for, and goes on. Any
   * other is replaced. Either way it plays at 1×.
   */
  start() {
    this.speed = 1;
    if (this.openedBy === 'cards' && (this.phase === 'intro' || this.phase === 'reel')) {
      this.openedBy = 'start';
      return;
    }
    this.begin(countOf(this.o), 'start');
  }

  begin(count, by) {
    const leaving = this.picturesOfCards();
    this.clear(count);
    // How long this ceremony's reel spins at the least: between `reelMinMs` and `reelMaxMs`, at 1×
    this.reelMs = reelLengthMs(this.o.climb.reelMinMs, this.o.climb.reelMaxMs);
    // Its pulses for sound, and whether the riser into its stop has been told
    this.pulseWait = PULSE_MS.first;
    this.pulses = 0;
    this.riserTold = false;
    this.whisk(leaving);
    this.openedBy = by;
    this.phase = 'intro';
    this.fresh = true;
    this.items.forEach((item, i) => {
      item.show();
      this.recolor(i, true);
    });
    this.updateIntro();
    this.announce('intro', this.o.climb.introMs);
  }

  /**
   * A picture of every card on show, where it stands — taken before the
   * stage is cleared for the next ceremony, which frees the cards themselves.
   * None when no card has come up.
   */
  picturesOfCards() {
    if (!this.phase || !this.items.some(item => item.revealed)) return [];
    const renderer = this.app.renderer;
    const pictures = [];
    for (const item of this.items) {
      const node = item.node;
      if (!node.visible || !(node.alpha > 0)) continue;
      const box = node.getLocalBounds();
      if (!(box.width > 0 && box.height > 0)) continue;
      const sprite = new Sprite(renderer.generateTexture({target: node, resolution: renderer.resolution}));
      // Its origin where the item's is, so it stands exactly over what it pictures
      sprite.anchor.set(-box.x / box.width, -box.y / box.height);
      sprite.position.copyFrom(node.position);
      sprite.scale.copyFrom(node.scale);
      pictures.push(sprite);
    }
    return pictures;
  }

  /**
   * The pictures leave: each turns its edge to the eye, shrinks and is gone
   * within `WHISK_MS`, and the stage is thrown as they go — the round is on.
   */
  whisk(pictures) {
    if (!pictures.length) return;
    this.emit(MESSAGES.CUE, {name: 'leave'});
    for (const sprite of pictures) {
      this.ghostLayer.addChild(sprite);
      this.ghosts.push({sprite, elapsed: 0, scale: sprite.scale.x});
    }
    this.strike(KICKS.start);
  }

  /**
   * The reel's moments for sound, told as cues: a `pulse` (its `value` how far through the reel, 0..1) every so
   * often, closer as the stop nears and quicker as the ceremony is hurried; and, once the cards are in and the stop
   * can be foreseen, a `riser` whose `value` is how many ms of the wall clock are left before it.
   */
  tellReel(deltaMS) {
    if (this.phase !== 'reel' || this.riserTold) return;
    const {introMs} = this.o.climb;
    const progress = clamp((this.clock - introMs) / Math.max(1, this.reelMs - introMs), 0, 1);
    this.pulseWait -= deltaMS;
    if (this.pulseWait <= 0) {
      this.pulseWait += PULSE_MS.from + (PULSE_MS.to - PULSE_MS.from) * progress;
      this.emit(MESSAGES.CUE, {name: 'pulse', index: this.pulses++, value: progress});
    }
    if (!this.cards || this.relay) return;
    const left = (this.reelMs - this.clock) / this.pace;
    if (left > RISER_MS.lead) return;
    this.riserTold = true;
    if (left >= RISER_MS.least) this.emit(MESSAGES.CUE, {name: 'riser', index: -1, value: Math.round(left)});
  }

  /** Each item that has just taken off into its spin, told once a ceremony: a sound may mark it. */
  tellTakeoffs() {
    if (this.phase !== 'reel' && this.phase !== 'intro') return;
    this.items.forEach((item, i) => {
      if (this.spunUp[i] || !item.kicked) return;
      this.spunUp[i] = true;
      this.emit(MESSAGES.CUE, {name: 'takeoff', index: i});
    });
  }

  updateGhosts(deltaMS) {
    if (!this.ghosts.length) return;
    this.ghosts = this.ghosts.filter(ghost => {
      ghost.elapsed += deltaMS;
      const t = clamp(ghost.elapsed / WHISK_MS, 0, 1);
      const small = ghost.scale * (1 + (WHISK_TO - 1) * t);
      // Edge-on by the end, gathering speed
      ghost.sprite.scale.set(small * (1 - t * t), small);
      ghost.sprite.alpha = 1 - t * t * t;
      if (t < 1) return true;
      ghost.sprite.destroy({texture: true, textureSource: true});
      return false;
    });
  }

  dropGhosts() {
    for (const {sprite} of this.ghosts) sprite.destroy({texture: true, textureSource: true});
    this.ghosts = [];
  }

  /**
   * The cards, in grid order — `{texture, color, hit, price}` each, the
   * texture null where the artwork never came, the scene's to free from here
   * on — and the combo to write under the grid, or null. A ceremony still
   * spinning takes them in place of any it had, and once its reel has run
   * `reelMinMs` the items stop. Cards that find none — none started, or one
   * whose items have begun to stop or are all up — begin a ceremony of their
   * own. A number of cards other than the items' re-lays the grid; no cards
   * at all end the ceremony (`endEmpty`).
   */
  setCards(entries, combo) {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) {
      this.endEmpty();
      return;
    }
    if (this.phase === 'intro' || this.phase === 'reel') this.dropCards();
    else this.begin(list.length, 'cards');
    // Artwork still loading comes later (`giveFace`): the items stop on their colours without it, and a card waits for it only to turn
    this.cardFaces.take(list.map(entry => (entry?.pending ? PENDING : (entry?.texture ?? null))));
    this.cardsToken = {};
    // Reset by the host on hearing the intro they began: they go with it
    if (!this.phase) {
      this.dropCards();
      return;
    }
    this.cards = list.map(cardOf);
    this.combo = typeof combo === 'string' && combo.trim() ? combo : null;
    if (this.phase === 'reel' && list.length !== this.items.length) this.regrid(list.length);
    if (this.skipWanted) this.finishNow();
  }

  /**
   * Card `i`'s artwork, come late — `texture`, or null for none — for the
   * batch `token` names (`cardsToken` as `setCards` left it). False when
   * that batch is gone or the card had its artwork already: the caller
   * keeps the texture and lets it go. A card already up shows it at once.
   */
  giveFace(token, i, texture) {
    if (!token || token !== this.cardsToken) return false;
    if (!this.cardFaces.give(i, texture)) return false;
    const item = this.items[i];
    if (item?.face && item.size) {
      item.setFace(this.cardFaces.faceOf(i, item.size, this.faceLook()));
      this.lightFace(item);
      if (item.faceUp) item.dress();
    }
    return true;
  }

  /** Card `i` may turn: its artwork is in, or none will come. */
  faceReady(i) {
    return this.cardFaces.ready(i);
  }

  /**
   * A batch with no cards: the ceremony on show — or, with none, one of its
   * own — is over at once, on a grid with no items, and the host is told as
   * for any ceremony that gets to its end: `done`, then an `allRevealed`
   * with no cards. The next `start()` brings the grid back.
   */
  endEmpty() {
    this.clear(this.items.length);
    // Started again by the host on hearing a waiting layout applied
    if (this.phase) return;
    this.setCount(0);
    this.layout();
    this.end();
  }

  /**
   * How fast the ceremony plays, as a multiple of its own pace: every clock
   * in it — the spin, the colours, the stops, the turns, the prices — runs
   * that much faster from this frame on, whatever is under way.
   */
  /** How many ms of the ceremony's time pass in one of the wall clock: `speed` while the items spin, 1 otherwise. */
  get pace() {
    return HURRIED.has(this.phase) ? this.speed : 1;
  }

  setSpeed(multiplier) {
    const speed = Number(multiplier);
    const was = this.speed;
    this.speed = Number.isFinite(speed) && speed > 0 ? speed : 1;
    // Hurried mid-ceremony: a sound may mark it, and a score keeping its own time takes the pace
    if (this.speed > was && this.phase && this.phase !== 'done') this.emit(MESSAGES.CUE, {name: 'speed', index: -1, value: this.speed});
  }

  /**
   * The ceremony at its end at once: every item at rest on its colour and
   * turned into its card, every price counted, the combo written. What the
   * host was not told yet is told now, in order and marked `skipped`, and
   * `allRevealed` once. Waiting for its cards, it ends the moment they come.
   * Nothing to end before `start()`, or once every card is up.
   */
  skipToEnd() {
    if (!this.phase || this.phase === 'done') return;
    if (!this.cards) {
      this.skipWanted = true;
      return;
    }
    this.finishNow();
  }

  finishNow() {
    this.skipWanted = false;
    // The grid for the cards as the reel would have left it: no flight, no fade
    this.relay = null;
    for (const {item} of this.leaving) item.destroy();
    this.leaving = [];
    if (this.cards.length !== this.items.length) {
      this.setCount(this.cards.length);
      this.relayout();
      // Reset or started again by the host on hearing `layout`: nothing left to end
      if (!this.cards) return;
    }
    this.flashClock = Infinity;
    this.flash.clear();
    // The stage comes to rest with its ceremony: a blow under way, the combo's count and what was in flight end here
    this.kick.clear();
    this.shaken.position.set(0, 0);
    this.beats = null;
    this.fx.clear();
    for (const pop of this.pops) pop.hide();
    this.gather = null;
    if (!this.sequence) this.sequence = new RevealSequence(this);
    this.sequence.finish();
  }

  /** A phase begun, and how long it will run: `sceneMs` at the pace of the moment, and `wallMs` that no pace hurries. */
  announce(name, sceneMs, wallMs = 0) {
    this.emit(MESSAGES.PHASE, {name, durationMs: Math.round(Math.max(0, sceneMs) / this.pace + Math.max(0, wallMs))});
  }

  /* ── frame ── */

  palette() {
    const configured = this.o.climb.cycleColors;
    return configured?.length ? configured : [this.o.theme.glow];
  }

  /**
   * Another colour for item `i`, eased into — or at once: its first, and every one of the reel's.
   * One still slowing down shows a reel colour yet, and is kept clear of;
   * one at rest shows its card's, and has no say.
   */
  recolor(i, immediate) {
    const palette = this.palette();
    const index = this.reelColors.next(i, palette.length, j => !this.items[j].settled);
    this.items[i].setColor(palette[index], immediate);
  }

  /** Each item takes a fresh colour at once every time it stands edge-on (`strobe.js`), until it is told to settle. */
  updateReel() {
    this.items.forEach((item, i) => {
      if (item.takeEdge() && !item.held) this.recolor(i, true);
    });
  }

  /**
   * One item grows in at the centre, where a lone item stands, at a lone
   * item's size; then every item leaves it for its own box, the last on top
   * leaving last, each a little after the one before — and the stage is
   * thrown as it bursts.
   */
  updateIntro() {
    const {introMs} = this.o.climb;
    const t = clamp(this.clock / Math.max(1, introMs), 0, 1);
    const n = this.items.length;
    if (n === 1) {
      const [item] = this.items;
      item.moveTo(item.home.x, item.home.y, ARRIVE_FROM + (1 - ARRIVE_FROM) * easeOut(t));
      item.setAlpha(clamp(t / ARRIVE, 0, 1));
    } else {
      const {x, y} = this.centre();
      const big = this.lone.width / Math.max(1, this.rects[0].width);
      const lead = n - 1;
      if (t < ARRIVE) {
        const g = t / ARRIVE;
        const scale = big * (ARRIVE_FROM + (1 - ARRIVE_FROM) * easeOut(g));
        this.items.forEach((item, i) => {
          item.moveTo(x, y, scale);
          item.setAlpha(i === lead ? clamp(g * 2, 0, 1) : 0);
        });
      } else {
        if (!this.struck.burst) {
          this.struck.burst = true;
          this.strike(KICKS.start);
        }
        const s = (t - ARRIVE) / (1 - ARRIVE);
        const step = Math.min(SPLIT_STEP, 0.4 / (n - 1));
        const span = 1 - step * (n - 1);
        this.items.forEach((item, i) => {
          const e = easeInOut(clamp((s - step * i) / span, 0, 1));
          item.moveTo(x + (item.home.x - x) * e, y + (item.home.y - y) * e, big + (1 - big) * e);
          item.setAlpha(i === lead ? 1 : clamp(e * 4, 0, 1));
        });
      }
    }
    if (t >= 1) {
      this.beginReel();
    }
  }

  /** Where a lone item stands: the intro's one item, and where new items come from. */
  centre() {
    const lone = this.lone;
    return {x: lone.left + lone.width / 2, y: lone.top + lone.height / 2};
  }

  /** The starts of `count` items (`reelStarts`), kept within the reel's shortest run. */
  startsFor(count) {
    const {introMs} = this.o.climb;
    return reelStarts(count, Math.random, START_ROOM * Math.max(0, this.reelMs - introMs));
  }

  /**
   * Every item home and starting to turn — one here, one there, in an order
   * drawn afresh, each barely turning at first and then taking off, at a
   * speed of its own (`reelStart.js`). Cards that came during the intro, in
   * another number, re-lay the grid from here.
   */
  beginReel() {
    this.phase = 'reel';
    const {introMs} = this.o.climb;
    const n = this.items.length;
    const starts = this.startsFor(n);
    this.items.forEach((item, i) => {
      item.moveTo(item.home.x, item.home.y, 1);
      item.setAlpha(1);
      item.spin(starts[i].delayMs, starts[i].rampMs, starts[i].rate);
    });
    // The shortest it runs, drawn for this ceremony: counted from its start
    this.announce('reel', this.reelMs - introMs);
    // Unless the host ended, replaced or reset the ceremony on hearing it
    if (this.phase === 'reel' && this.cards && this.cards.length !== n) this.regrid(this.cards.length);
  }

  /**
   * A grid for `count` items in the middle of the reel: each item there
   * moves to the new box nearest it, new ones fly in from the centre, and the
   * ones left over fade where they stand — all of them spinning and cycling
   * colours. Until they stop the items all look alike, so none has to cross
   * the grid to keep its place in the order. One still fading in from a
   * re-lay just before comes up the rest of the way as it moves.
   */
  regrid(count) {
    const was = this.items;
    const boxes = this.gridFor(count).map(r => ({x: r.left + r.width / 2, y: r.top + r.height / 2}));
    const pairs = [];
    was.forEach((item, i) => {
      boxes.forEach((box, j) => {
        pairs.push({i, j, d: Math.hypot(item.node.x - box.x, item.node.y - box.y)});
      });
    });
    pairs.sort((p, q) => p.d - q.d);
    // Closest pairs first: `at[j]` is the item box `j` takes, -1 for a new one
    const at = new Array(count).fill(-1);
    const taken = new Array(was.length).fill(false);
    for (const {i, j} of pairs) {
      if (taken[i] || at[j] >= 0) continue;
      taken[i] = true;
      at[j] = i;
    }
    const from = was.map(item => ({
      x: item.node.x,
      y: item.node.y,
      width: item.size.width * item.node.scale.x,
      alpha: item.node.alpha,
    }));
    was.forEach((item, i) => {
      if (!taken[i]) this.leaving.push({item, elapsed: 0, alpha: item.node.alpha});
    });
    this.items = at.map(i => (i >= 0 ? was[i] : new ClimbItem(this.itemLayer, this.texture, this.glow, this.o)));
    this.reelColors.follow(at);
    while (this.labels.length > count) this.labels.pop().destroy();
    while (this.labels.length < count) this.labels.push(new PriceLabel(this.labelLayer, this.o.climb.font));
    while (this.pops.length > count) this.pops.pop().destroy();
    while (this.pops.length < count) this.pops.push(new PricePop(this.popLayer, this.o.climb.font, this.star));
    this.relayout();
    // Ended, replaced or reset by the host on hearing `layout`; a `start()`
    // that takes this ceremony over leaves it spinning, and the move goes on
    if (this.phase !== 'reel') return;
    const starts = this.startsFor(count);
    at.forEach((i, j) => {
      if (i >= 0) return;
      const item = this.items[j];
      item.show();
      item.setAlpha(0);
      this.recolor(j, true);
      item.spin(starts[j].delayMs, starts[j].rampMs, starts[j].rate);
    });
    this.relay = {elapsed: 0, from: at.map(i => (i >= 0 ? from[i] : null))};
    this.updateRelay(0);
  }

  get relayMs() {
    return Math.max(1, this.o.climb.introMs * (1 - ARRIVE));
  }

  updateRelay(deltaMS) {
    const relay = this.relay;
    if (!relay) return;
    relay.elapsed += deltaMS;
    const t = clamp(relay.elapsed / this.relayMs, 0, 1);
    const centre = this.centre();
    const fresh = relay.from.filter(from => !from).length;
    const step = fresh > 1 ? Math.min(SPLIT_STEP, 0.4 / (fresh - 1)) : 0;
    const span = 1 - step * Math.max(0, fresh - 1);
    let k = 0;
    this.items.forEach((item, i) => {
      const {x, y} = item.home;
      const from = relay.from[i];
      if (from) {
        const e = easeInOut(t);
        const scale = from.width / Math.max(1, item.size.width);
        item.moveTo(from.x + (x - from.x) * e, from.y + (y - from.y) * e, scale + (1 - scale) * e);
        item.setAlpha(from.alpha + (1 - from.alpha) * e);
      } else {
        const e = easeInOut(clamp((t - step * k++) / span, 0, 1));
        item.moveTo(centre.x + (x - centre.x) * e, centre.y + (y - centre.y) * e, 1);
        item.setAlpha(clamp(e * 4, 0, 1));
      }
    });
    if (t >= 1) this.relay = null;
  }

  updateLeaving(deltaMS) {
    if (!this.leaving.length) return;
    this.leaving = this.leaving.filter(gone => {
      gone.elapsed += deltaMS;
      const t = clamp(gone.elapsed / this.relayMs, 0, 1);
      gone.item.setAlpha(gone.alpha * (1 - easeOut(t)));
      gone.item.update(deltaMS);
      if (t < 1) return true;
      gone.item.destroy();
      return false;
    });
  }

  get turnMs() {
    return TURN_TURNS * this.o.climb.spinMs;
  }

  /**
   * Item `i` turning over into its card — or, with `climb.reveal`
   * `shatter`, its pack bursting off it in pieces while the card punches up
   * in its place.
   */
  turnItem(i, lift) {
    const item = this.items[i];
    item.setFace(this.cardFaces.faceOf(i, item.size, this.faceLook()));
    this.lightFace(item);
    const burst = this.o.climb.reveal === 'shatter' && !!this.o.climb.sparkle;
    if (burst) this.shatter.burst(item.backView());
    item.turn(this.turnMs, lift, burst);
    // Its card coming up, told with where its colour stands in the palette: the higher, the fuller its sound
    this.emit(MESSAGES.CUE, {name: 'burst', index: i, value: this.colorIndexOf(this.cards?.[i]?.color)});
  }

  /** Card `i` up: a hit stands in its rays, and the stage takes the haze of the best colour up so far. */
  glowFor(i) {
    const card = this.cards?.[i];
    if (!card) return;
    const color = toNumber(card.color, 0xffffff);
    if (card.hit) this.auras.light(this.items[i], color);
    this.auras.tone(color, this.colorIndexOf(card.color), card.hit ? HAZE.hit : HAZE.plain);
  }

  /** Item `i` at rest as its card, in its colour, at once: where a skipped ceremony leaves it. */
  faceUp(i) {
    const item = this.items[i];
    if (!item.face) item.setFace(this.cardFaces.faceOf(i, item.size, this.faceLook()));
    this.lightFace(item);
    // Put up, not turned: it throws nothing, but stands in its light
    this.faced[i] = true;
    item.finish(this.cards[i]?.color);
    this.glowFor(i);
  }

  /**
   * Each card whose face has just come up in its turn pops its light and
   * throws its shards and glints — a hit twice as many — and a hit throws
   * the stage, under the flash. Never a card a skip put up at once.
   */
  tellFaced() {
    if (!this.cards) return;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const card = this.cards[i];
      if (!card || !item.faceUp || this.faced[i]) continue;
      this.faced[i] = true;
      if (card.hit) this.strike(KICKS.hits);
      this.glowFor(i);
      if (!this.o.climb.sparkle) continue;
      item.pop();
      // A burst pack's light is the flare's
      this.fx.burst(item.bounds(), toNumber(card.color, 0xffffff), {
        style: this.o.climb.reveal === 'shatter' ? 'flare' : this.o.climb.reveal,
        hit: card.hit,
        crowd: this.items.length,
      });
    }
  }

  /** How much harder than the lowest a card alone lands: the higher its colour stands in the palette, the harder. */
  loneGain(color) {
    const top = Math.max(1, this.palette().length - 1);
    const rung = clamp(this.colorIndexOf(color) / top, 0, 1);
    return 1 + (LONE_GAIN_TOP - 1) * rung;
  }

  /** The shake `poses`, `gain` times as hard, on this stage — as hard as `climb.shake` lets it be. */
  strike(poses, gain = 1) {
    const scale = clamp(this.app.screen.width / KICK_STAGE, KICK_SCALE.min, KICK_SCALE.max);
    this.kick.strike(poses, gain * scale * clamp(Number(this.o.climb.shake ?? 1), 0, 1));
  }

  /**
   * A blow to the stage on the host's word — a sum reaching the balance:
   * `strength` 0..1 of the hardest the scene strikes itself, the hits'.
   * Nothing to shake before `start()`.
   */
  shake(strength = 1) {
    if (!this.phase) return;
    // Woken from its sleep, the first frame's whole nap would swallow the blow
    this.fresh = true;
    const share = Number(strength ?? 1);
    const gain = (clamp(Number.isFinite(share) ? share : 0, 0, 1) * peakOf(KICKS.hits)) / peakOf(KICKS.credit);
    this.strike(this.items.length === 1 ? KICKS.creditLone : KICKS.credit, gain);
  }

  /**
   * A card has landed on its face in its turn. The first ordinary card of a
   * grid throws the stage sideways — the cards after it land on a stage that
   * is shaking already, and add nothing; a card alone throws it the harder
   * the higher its tier; the hits, thrown already as they came round under
   * the flash, throw it once more as they land.
   */
  strikeLanding(i) {
    const card = this.cards[i];
    if (card.hit) {
      if (this.struck.hitsLanded) return;
      this.struck.hitsLanded = true;
      this.strike(KICKS.hits);
      return;
    }
    if (this.struck.landed) return;
    this.struck.landed = true;
    if (this.items.length === 1) this.strike(KICKS.lone, this.loneGain(card.color));
    else this.strike(KICKS.land);
  }

  /** The cards the combo counts, in grid order (`comboIndices`): those the host named, or worked out from the colours. */
  comboCards() {
    return comboIndices(this.cards, color => this.colorIndexOf(color), COMBO_BEATS_MAX);
  }


  /** How long the combo's count runs after its first beat, in ms of the wall clock. */
  get countMs() {
    return this.combo ? Math.max(0, this.comboCards().length - 1) * COMBO_BEAT_MS : 0;
  }

  /** The combo has come down: it counts its hits out from here, the first at once. */
  beginBeats() {
    const hits = this.comboCards();
    // Words with no hit to count still come down with a thump
    if (!hits.length) {
      this.strike(KICKS.combo);
      return;
    }
    this.beats = {hits, next: 0, wait: 0};
    this.updateBeats(0);
  }

  /** The beats due by now: each thumps the stage and pulses its hit, and the words start at every one after the first. */
  updateBeats(deltaMS) {
    const beats = this.beats;
    if (!beats) return;
    beats.wait -= deltaMS;
    while (beats.next < beats.hits.length && beats.wait <= 0) {
      const k = beats.next++;
      beats.wait += COMBO_BEAT_MS;
      // A beat always takes the stage: a blow on the host's word a moment before does not swallow it
      this.kick.clear();
      this.strike(KICKS.combo);
      this.items[beats.hits[k]]?.pulse();
      if (k > 0) this.banner.repop();
      this.emit(MESSAGES.CUE, {name: 'beat', index: k});
    }
    if (beats.next >= beats.hits.length) this.beats = null;
  }

  /**
   * One card's face baked ahead of its turn each frame, from the moment the
   * cards are in and the grid has their number — so no turn waits on a
   * canvas, the hits that turn together least of all.
   */
  bakeAhead() {
    if (!this.cards || this.cards.length !== this.items.length) return;
    this.cardFaces.bakeNext(i => (this.items[i].face ? null : this.items[i].size), this.faceLook());
  }

  /** Where `color` stands in the reel's palette, lowest first; -1 when it is not one of them. */
  colorIndexOf(color) {
    const n = toNumber(color, -1);
    return this.palette().findIndex(c => toNumber(c, -2) === n);
  }

  /**
   * Card `i` is face up: its price is there over its top edge, counting up,
   * its tier is written under it, and the host is told where it is. A card
   * sold already goes dark a moment after. A ceremony skipped to its end
   * shows no large price: tier and price are written under the card at once.
   */
  announceRevealed(i, skipped) {
    const card = this.items[i].bounds();
    const label = this.labels[i];
    const {price, tier, color, sold} = this.cards[i];
    label.place(card);
    label.start(price, this.o.climb.price, {tier, color});
    if (skipped) {
      label.complete();
    } else {
      this.pops[i].place(card);
      this.pops[i].start(price, this.o.climb.price);
    }
    if (sold) {
      this.items[i].setSold(skipped ? 0 : this.o.climb.rollUpMs, !!skipped);
      label.markSold();
    }
    // A hit's light stands wider from here on; a card turned in its turn takes a band of sheen, a hit a star too
    if (this.cards[i].hit) this.items[i].setHit(!!skipped);
    if (!skipped) this.strikeLanding(i);
    if (!skipped && this.o.climb.sparkle) {
      // The band of light crosses the card once its price is counted and its stars are out
      this.fx.sheen(card, SHEEN_AFTER_MS);
      if (this.cards[i].hit) this.fx.glint(card, toNumber(color, 0xffffff));
    }
    this.emit(MESSAGES.CARD_REVEALED, skipped ? {index: i, card, skipped: true} : {index: i, card});
  }

  /**
   * Cards `indices` of the ceremony on show sold since they came: each goes
   * dark and is marked sold under its price — at once when it is up, once its
   * price has counted otherwise. Indices outside the grid, and cards already
   * sold, are passed over.
   */
  markSold(indices) {
    if (!this.cards) return;
    for (const raw of Array.isArray(indices) ? indices : []) {
      const i = Math.floor(Number(raw));
      const card = this.cards[i];
      if (!card || card.sold) continue;
      card.sold = true;
      if (!this.items[i]?.revealed) continue;
      // Woken from its sleep, the first frame's whole nap would darken it in one step
      this.fresh = true;
      this.items[i].setSold(0);
      this.labels[i].markSold();
    }
  }

  /** The flash as the hits come round, when the climb has one. */
  strikeFlash() {
    if (this.o.climb.flash) this.flashClock = 0;
  }

  /** The combo under the grid, in the light of the hits it counts, landing over `ms`. */
  writeCombo(ms) {
    const [first] = this.comboCards();
    this.banner.show(this.combo, toNumber(this.cards[first]?.color, 0xffffff), ms);
  }

  /** Every price counted and every line under the cards in place. */
  pricesCounted() {
    return this.pops.every(pop => pop.counted) && this.labels.every(label => label.finished);
  }

  /**
   * Where the prices gather: the middle of the stage's width, `climb.gatherY`
   * css px from its top — negative or unnamed, in the band the host keeps
   * over the grid, where it writes the total.
   */
  gatherPoint() {
    const asked = Number(this.o.climb.gatherY);
    const y = asked >= 0 ? asked : this.o.layout.stage.reserveTop * GATHER_Y;
    return {x: this.app.screen.width / 2, y};
  }

  /**
   * Every card up and counted: the prices stand a moment, then leave their
   * cards for the total, the nearest first, and each card keeps its price
   * small under its tier. False when no price is on show — nothing to gather.
   */
  beginGather() {
    if (!this.pops.some(pop => pop.showing)) return false;
    this.phase = 'gather';
    this.gather = {wait: GATHER.holdMs, flown: false};
    // By the wall clock, as the prices themselves: hurried, they would be gone before they were read
    this.announce('gather', 0, GATHER.holdMs + GATHER.spreadMs + GATHER.flightMs);
    return true;
  }

  updateGather(deltaMS) {
    const gather = this.gather;
    if (!gather) return;
    if (gather.flown) {
      if (!this.pops.some(pop => pop.showing)) this.gather = null;
      return;
    }
    gather.wait -= deltaMS;
    if (gather.wait > 0) return;
    gather.flown = true;
    const to = this.gatherPoint();
    const flying = this.pops.filter(pop => pop.showing);
    const delays = gatherDelays(flying.map(pop => pop.home), to);
    flying.forEach((pop, k) => pop.fly(to, GATHER.flightMs, delays[k]));
    for (const label of this.labels) label.showPrice();
  }

  /**
   * Every card up: a layout that waited for the end is applied, and the
   * host is told where every card is — once. A host that starts another
   * ceremony or resets this one on hearing `layout` or `done` hears no more
   * of this one.
   */
  end() {
    if (this.phase === 'done') return;
    this.phase = 'done';
    if (this.pendingLayout) {
      this.pendingLayout = false;
      this.relayout();
      if (this.phase !== 'done') return;
    }
    this.announce('done', 0);
    if (this.phase !== 'done') return;
    this.emit(MESSAGES.ALL_REVEALED, {cards: this.items.map(item => item.bounds())});
  }

  /** The flash, `deltaMS` of the wall clock on: it covers the hits' shake, which no pace hurries. */
  updateFlash(deltaMS) {
    if (this.flashClock === Infinity) return;
    this.flashClock += deltaMS;
    this.flash.play(this.flashClock, FLASH_MS, FLASH_ALPHA, WHITE, FLASH_HOLD);
    if (this.flashClock >= FLASH_MS) this.flashClock = Infinity;
  }

  /** The ceremony's next steps, as far as this frame takes it. */
  advance(deltaMS) {
    switch (this.phase) {
      case 'intro':
        this.updateIntro();
        break;
      case 'reel':
        if (this.cards && !this.relay && this.clock >= this.reelMs) {
          this.sequence = new RevealSequence(this);
          this.sequence.begin();
        }
        break;
      default:
        this.sequence?.update(deltaMS);
        break;
    }
  }

  update(deltaMS) {
    // The dust rises whether a ceremony runs or not — a frame after a long sleep no further than one frame's worth
    this.dust.update(Math.min(deltaMS, DUST_FRAME_MS));
    if (!this.phase) {
      this.dust.shake(0, 0);
      return;
    }
    // The wall clock, and the ceremony's own: a shake lasts what it lasts, however the ceremony is hurried
    const real = this.fresh ? Math.min(deltaMS, FRAME_MS) : deltaMS;
    const dt = real * this.pace;
    this.fresh = false;
    this.wall = real;
    this.clock += dt;
    this.updateGhosts(real);
    this.tellTakeoffs();
    this.tellReel(dt);
    this.updateRelay(dt);
    this.advance(dt);
    this.updateReel();
    for (const item of this.items) item.update(dt, real);
    // Cards stamped SOLD this frame: one thump for all of them
    if (this.items.reduce((any, item) => item.takeStamped() || any, false)) this.emit(MESSAGES.CUE, {name: 'stamp', index: -1});
    // A pack alone has nothing to burst into: the stage is thrown as it takes off
    if (this.phase === 'reel' && !this.struck.burst && this.items.length === 1 && this.items[0].kicked) {
      this.struck.burst = true;
      this.strike(KICKS.spin);
    }
    this.tellFaced();
    this.updateLeaving(dt);
    this.sequence?.report();
    // Reset or torn down by the host on hearing what this frame told it
    if (!this.phase) return;
    for (const label of this.labels) label.update(dt);
    for (const pop of this.pops) pop.update(real);
    this.updateGather(real);
    this.banner.update(dt, real);
    if (this.banner.takeStrike()) this.beginBeats();
    else this.updateBeats(real);
    this.fx.update(dt);
    this.shatter.update(dt);
    this.auras.update(real);
    this.kick.update(real);
    const thrown = this.kick.offset();
    this.shaken.position.set(thrown.x, thrown.y);
    this.dust.shake(thrown.x, thrown.y);
    this.updateFlash(real);
    this.sequence?.conclude();
    this.bakeAhead();
  }

  /**
   * Everything let go of. A host may call it from inside one of the scene's
   * own events: the reveal under way is no longer live, the frame goes no
   * further and the host hears nothing more.
   */
  destroy() {
    this.phase = null;
    this.sequence = null;
    this.skipWanted = false;
    this.emit = () => {};
    for (const item of this.items) item.destroy();
    for (const {item} of this.leaving) item.destroy();
    for (const label of this.labels) label.destroy();
    for (const pop of this.pops) pop.destroy();
    this.star.destroy(true);
    this.items = [];
    this.leaving = [];
    this.labels = [];
    this.pops = [];
    this.banner.destroy();
    this.fx.destroy();
    this.shatter.destroy();
    this.auras.destroy();
    this.dropGhosts();
    this.dust.destroy();
    this.root.destroy({children: true});
    this.dropCards();
    this.glow?.texture.destroy(true);
    this.glow?.bloom.destroy(true);
    this.glow = null;
  }
}
