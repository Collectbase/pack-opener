/**
 * Pixi scene for the `carousel` mechanic: copies of the pack hover on a
 * turntable, mirrored in the floor; a finger turns it, a shuffle spins it
 * round and chooses the copy it stops on, a tap chooses one outright — the
 * chosen copy drops off the ring and rises to centre stage, where it floats
 * until it is tapped again. Then the pack dissolves and the pull is told
 * before it is shown — a fact at a time, the tier shouted across a banner —
 * and the blank card flips over into the artwork, on the same stand every
 * mechanic ends on.
 *
 * Two moments, on purpose: the choice (which copy — theatre, since they are
 * all the same pack, but a choice the hand makes) and the open. The host
 * opens the pack server-side between them, which is why the float can last
 * as long as it has to: only the hover moves, and nothing loops or repeats
 * while it waits.
 *
 * Like every variant it knows nothing about where it runs. It draws, it
 * reads the gesture it is handed, and it reports what happened via `emit`.
 */
import {Container, Sprite} from 'pixi.js';
import {MESSAGES} from '../../config/protocol';
import {toNumber} from '../../runtime/color';
import {CardPedestal} from '../shared/pedestal';
import {RevealCard} from '../shared/card';
import {clamp, computePackRect, easeInOut, easeOut} from '../shared/geometry';
import {contentBoundsOf} from '../shared/textures';
import {Story} from './story';
import {Turntable, wrap} from './turntable';

/** How far outside a pack a tap still counts as being on it. */
const TOUCH_SLOP = 12;
/** A tap, not a drag: the finger may wander this far. */
const TAP_SLOP = 14;
/** How long the story takes to give way to the card. */
const STORY_SWAP_MS = 300;
/** The held pack takes at most this much of the stage's height. */
const HELD_MAX_SHARE = 0.7;
/** A flung ring coasts this much longer than the finger before it settles. */
const COAST_MS = 220;
/** The drag's speed is read over this much of its past, so a last twitch does not decide it. */
const VELOCITY_WINDOW_MS = 80;

const sceneColors = theme => ({
  glow: toNumber(theme.glow),
  beam: toNumber(theme.beam),
  spark: toNumber(theme.spark),
});

export class CarouselScene {
  constructor(app, texture, options, emit) {
    this.app = app;
    this.texture = texture;
    this.emit = emit || (() => {});
    this.o = options;
    this.colors = sceneColors(options.theme);

    this.clock = 0;
    // Pack fades in instead of popping, as in every variant
    this.intro = 0;
    this.enabled = true;
    this.locked = false;
    this.ignoring = false;
    this.tracking = false;
    this.down = null;
    this.moved = null;
    // The finger turning the ring, while it does
    this.drag = null;
    this.artWaitStart = 0;
    this.floatClock = 0;
    this.bannerClock = 0;
    // Where the ceremony is: on the ring, holding the chosen pack, opening it, done
    this.stage = 'ring';
    this.anim = null;
    this.cardIn = false;
    // Which copy is nearest the front: a change is a step, announced
    this.frontIndex = 0;

    this.root = new Container();
    this.root.alpha = 0;
    app.stage.addChild(this.root);

    // Where the pack is in its image: the layout is of the pack, not the margins
    this.content = contentBoundsOf(texture);
    this.rect = this.layoutRect(
      app.screen.width,
      app.screen.height,
      texture.width / texture.height,
    );

    this.turntable = new Turntable(this.root, texture, this.o);
    this.turntable.layout(this.rect);
    this.frontIndex = this.turntable.nearest;

    // The chosen pack, lifted off the ring: its own sprite, so the ring can
    // fade under it while it rises
    this.held = new Sprite(texture);
    this.held.anchor.set(0.5);
    this.held.visible = false;
    this.root.addChild(this.held);

    this.card = new RevealCard(this.root, app.screen, this.o, this.colors);
    this.pedestal = new CardPedestal(this.root, this.o);
    this.story = new Story(this.root, this.o);
  }

  get activity() {
    if (this.anim || this.tracking || this.intro < 1) return 'busy';
    // The ring drifts on its own and the held pack floats; the finished card rests
    return this.stage === 'done' ? 'idle' : 'hint';
  }

  /* ── layout ── */

  /**
   * The front copy's box. The ring has the whole stage: the bands the host
   * keeps back are for the winner's chrome around the card, which is not on
   * the stage while the ring is, and a ring squeezed into the band between
   * them comes out a toy on a phone. So it is sized and centred on the stage
   * itself, nudged by `offsetY`. With `layout.pack.anchor: 'card'` it is
   * placed so the held pack, which grows from it, is centred where the card
   * will rest.
   */
  layoutRect(width, height, aspect) {
    const {pack} = this.o.layout;
    // Laid out for the pack as seen — the opaque part of its image — and
    // then widened to the whole image around it, so `widthRatio` is the
    // pack's share of the stage whatever margins the artwork carries
    const c = this.content;
    const fw = c.right - c.left;
    const fh = c.bottom - c.top;
    const seenAspect = (aspect * fw) / fh;
    let seen = computePackRect(width, height, seenAspect, pack, undefined);
    if (pack.anchor === 'card') {
      const anchorY = RevealCard.restingCentre({width, height}, seen, this.o);
      seen = computePackRect(width, height, seenAspect, pack, undefined, anchorY);
    }
    const w = seen.width / fw;
    const h = seen.height / fh;
    const left = seen.left - c.left * w;
    const top = seen.top - c.top * h;
    return {left, top, right: left + w, bottom: top + h, width: w, height: h};
  }

  /**
   * The held pack's box at full rise: the front copy grown by `riseScale`,
   * but never past most of the stage. The card is built from this box and
   * fitted into the band the host left free on its own (see
   * `cardLayoutFor`); the pack dissolves before the card is seen, so the
   * two need not be the same size.
   */
  heldRect() {
    const {rect} = this;
    const grow = Math.min(
      this.o.carousel.riseScale,
      (this.app.screen.height * HELD_MAX_SHARE) / rect.height,
    );
    const w = rect.width * grow;
    const h = rect.height * grow;
    const cx = rect.left + rect.width / 2;
    // Centred on the stage's free band, where the card will come to rest
    const cy = RevealCard.restingCentre(this.app.screen, {...rect, width: w, height: h}, this.o);
    return {left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2, width: w, height: h};
  }

  heldBounds() {
    if (!this.held.visible) return null;
    const s = this.held;
    return {
      left: s.x - s.width / 2,
      right: s.x + s.width / 2,
      top: s.y - s.height / 2,
      bottom: s.y + s.height / 2,
      width: s.width,
      height: s.height,
    };
  }

  /* ── gesture ── */

  /**
   * Whether a gesture can be read: nothing in flight except the float, which
   * is a wait, and the ring settling after a turn, which a finger may catch.
   */
  get idle() {
    return !this.anim || this.anim.kind === 'float' || this.anim.kind === 'settle';
  }

  onDown(x, y) {
    if (!this.enabled || this.locked || !this.idle) {
      this.ignoring = true;
      return;
    }
    this.ignoring = false;
    this.tracking = true;
    this.down = {x, y};
    this.moved = {x, y};
    if (this.stage === 'ring') {
      // A ring still settling is caught where it is
      if (this.anim?.kind === 'settle') this.anim = null;
      this.drag = {
        turning: false,
        fromAngle: this.turntable.angle,
        samples: [{t: this.clock, angle: this.turntable.angle}],
      };
    }
    this.emit(MESSAGES.INTERACTION_START);
  }

  onMove(x, y) {
    if (!this.tracking) return;
    this.moved = {x, y};
    const drag = this.drag;
    if (!drag || !this.down) return;
    const dx = x - this.down.x;
    // Past the tap's slop the finger is turning the ring, and keeps turning
    // it: a drag across one pack width is `dragTurn` of a turn
    if (!drag.turning && Math.hypot(dx, y - this.down.y) <= TAP_SLOP) return;
    drag.turning = true;
    const angle = drag.fromAngle + (dx / this.rect.width) * this.o.carousel.dragTurn * Math.PI * 2;
    this.turntable.angle = angle;
    this.turntable.place();
    this.noteStep();
    drag.samples.push({t: this.clock, angle});
    while (drag.samples.length > 2 && this.clock - drag.samples[1].t > VELOCITY_WINDOW_MS) {
      drag.samples.shift();
    }
  }

  onUp() {
    if (!this.tracking) return;
    this.tracking = false;
    if (this.ignoring || !this.down) return;
    const {x, y} = this.down;
    const moved = this.moved ?? this.down;
    const drag = this.drag;
    this.down = null;
    this.drag = null;
    if (drag?.turning) {
      // Let go: the ring coasts with the finger's speed and settles on the
      // nearest copy. The gesture chose nothing
      const first = drag.samples[0];
      const last = drag.samples[drag.samples.length - 1];
      const dt = Math.max(1, last.t - first.t);
      const velocity = drag.samples.length > 1 ? (last.angle - first.angle) / dt : 0;
      this.emit(MESSAGES.RETRACTED);
      this.settle(this.turntable.angle + velocity * COAST_MS);
      return;
    }
    // A wander is not a tap: nothing chosen, nothing opened
    if (Math.hypot(moved.x - x, moved.y - y) > TAP_SLOP) {
      this.emit(MESSAGES.RETRACTED);
      if (this.stage === 'ring') this.settle(this.turntable.angle);
      return;
    }
    if (this.stage === 'ring') {
      const index = this.turntable.hit(x, y);
      if (index < 0) {
        this.emit(MESSAGES.RETRACTED);
        // A ring caught mid-settle and let go again finishes settling
        this.settle(this.turntable.angle);
        return;
      }
      this.choose(index);
      return;
    }
    if (this.stage === 'held') {
      const b = this.heldBounds();
      const inside =
        b &&
        x >= b.left - TOUCH_SLOP &&
        x <= b.right + TOUCH_SLOP &&
        y >= b.top - TOUCH_SLOP &&
        y <= b.bottom + TOUCH_SLOP;
      if (!inside) {
        this.emit(MESSAGES.RETRACTED);
        return;
      }
      this.open();
    }
  }

  /**
   * The host's shuffle: the ring turns on, `shuffleTurns` whole times plus
   * whatever brings some other copy to the front, and settles there — and
   * the copy it settles on is the choice: it drops and rises as if tapped,
   * so the shuffle is a way of choosing, not a prelude to it. A whole turn
   * is every copy passing through every place, which is the point: after
   * it nobody can say which copy was where.
   */
  shuffle() {
    if (this.locked || this.stage !== 'ring' || this.tracking) return;
    if (this.anim && this.anim.kind !== 'settle') return;
    const c = this.o.carousel;
    const count = this.turntable.copies.length;
    const from = this.turntable.angle;
    // Some other copy ends up in front — never the same one
    const current = this.turntable.nearest;
    const next =
      (current + 1 + Math.floor(Math.random() * Math.max(1, count - 1))) % count;
    let delta = this.turntable.angleFor(next) - from;
    while (delta <= 0) delta += Math.PI * 2;
    // Turned the other way half the time, so it does not always go the same way
    const sign = Math.random() < 0.5 ? 1 : -1;
    this.shuffleFrom = from;
    this.shuffleDelta = sign * (delta + c.shuffleTurns * Math.PI * 2);
    if (sign < 0) this.shuffleDelta = -(Math.PI * 2 - delta + c.shuffleTurns * Math.PI * 2);
    this.animate('shuffle', c.shuffleMs, () => {
      this.turntable.setAngle(this.turntable.angleFor(next));
      this.noteStep();
      this.choose(next);
    });
  }

  /**
   * A copy has come to the front, or the ring has turned past one: a step,
   * for the host to click on. Read after every turn of the ring.
   */
  noteStep() {
    const nearest = this.turntable.nearest;
    if (nearest === this.frontIndex) return;
    this.frontIndex = nearest;
    this.emit(MESSAGES.PHASE, {name: 'step', durationMs: 0});
  }

  /**
   * The ring turning on its own to rest with a copy squarely in front: the
   * nearest rest to `angle`, which a flung ring may have overshot by turns.
   * Nothing to settle is nothing done.
   */
  settle(angle) {
    const from = this.turntable.angle;
    const to = this.turntable.nearestRest(angle);
    let delta = to - from;
    // The ring's own angle wraps: aim for the rest the short way round
    // unless the fling carried it further
    if (Math.abs(angle - from) < Math.PI) delta = wrap(delta);
    if (Math.abs(delta) < 1e-4) return;
    this.settleFrom = from;
    this.settleDelta = delta;
    const c = this.o.carousel;
    // Longer for a longer way, up to a full shuffle
    const ms = Math.round(c.settleMs * clamp(0.5 + Math.abs(delta) / Math.PI, 0.5, 2));
    this.animate('settle', ms, () => {}, true);
  }

  /**
   * Copy `index` tapped: it drops off the ring as its neighbours fade, then
   * rises alone to centre stage and floats there for the second tap. The
   * host hears `committed` here — this is the choice.
   */
  choose(index) {
    if (this.stage !== 'ring') return;
    this.turntable.chosen = index;
    this.stage = 'held';
    this.locked = true;
    this.emit(MESSAGES.COMMITTED);
    const c = this.o.carousel;
    this.animate('drop', c.dropMs, () => {
      const from = this.turntable.boundsOf(index) ?? this.rect;
      this.riseFrom = {
        x: from.left + from.width / 2,
        y: from.top + from.height / 2,
        w: from.width,
        h: from.height,
      };
      this.turntable.setAlpha(0);
      this.held.visible = true;
      this.animate('rise', c.riseMs, () => {
        // The pack is up: the tap to open it is armed again
        this.locked = false;
        this.floatClock = 0;
        this.animate('float', 0, null, false);
      });
    });
  }

  /**
   * The second tap: the pack goes, the pull is told, then shown. The host
   * hears `opened` when the pack has dissolved — its cue to fetch the card
   * if it has not already — and the facts and the banner are read from the
   * options when their moment comes, so ones that arrive during the
   * dissolve are still told.
   */
  open() {
    if (this.stage !== 'held') return;
    this.stage = 'opening';
    this.locked = true;
    this.anim = null;
    this.prepareCard();
    const c = this.o.carousel;
    this.animate('dissolve', c.dissolveMs, () => {
      this.held.visible = false;
      this.emit(MESSAGES.OPENED);
      this.startStory();
    });
  }

  /** The facts, one after another, then the pill; nothing to tell skips straight on. */
  startStory() {
    this.story.build(this.heldRect(), this.app.screen);
    this.story.setAlpha(1);
    if (this.story.beats === 0) {
      this.startBanner();
      return;
    }
    this.animate('facts', this.storyLength(), () => this.startBanner());
  }

  storyLength() {
    const c = this.o.carousel;
    const beats = this.story.beats;
    return beats * c.factMs + Math.max(0, beats - 1) * c.factGapMs + c.factGapMs;
  }

  /** The banner, for a tier that has one; otherwise straight to the flip. */
  startBanner() {
    if (!this.o.assets.card.badge) {
      this.startFlip();
      return;
    }
    const c = this.o.carousel;
    this.story.buildBanner(this.heldRect(), this.app.screen);
    this.bannerClock = 0;
    this.animate('banner', c.bannerMs + c.bannerHoldMs, () => this.startFlip());
  }

  /**
   * The flip: the story fades, the blank card turns over into the artwork
   * and the stand comes in under it. Artwork still on its way holds the
   * card face-down, turning on, until it comes — announced once.
   */
  startFlip() {
    const firstHold = !this.card.hasArt && !this.artWaitStart;
    if (firstHold) this.artWaitStart = Date.now();
    const waited = this.artWaitStart ? Date.now() - this.artWaitStart : 0;
    if (!this.card.hasArt && waited < this.o.assets.card.timeoutMs) {
      this.animate('spinHold', this.o.motion.reveal.artWaitSpinMs, () => this.startFlip(), !firstHold);
      return;
    }
    const c = this.o.carousel;
    this.animate('flip', c.flipMs, () => {
      this.story.destroyBanner();
      this.story.clear();
      this.pedestal.reveal();
      this.animate('hold', this.o.motion.reveal.holdMs, () => {
        this.stage = 'done';
        this.emit(MESSAGES.REVEALED, {
          card: this.card.bounds(),
          pedestal: this.pedestal.bounds(),
        });
      });
    });
  }

  /** The card, built where the held pack is, so the flip happens in its place. */
  prepareCard() {
    const rect = this.heldRect();
    if (!this.card.built) {
      this.card.build(rect);
    }
    this.card.place(rect);
    this.standCard();
  }

  /** Where the card comes to rest, and its stand under it. */
  standCard() {
    this.cardRect = this.card.bounds();
    this.pedestal.build(
      this.cardRect.left + this.cardRect.width / 2,
      this.cardRect.bottom,
      this.cardRect.width,
    );
  }

  setCardTexture(texture) {
    // Built again to the artwork's shape, the card rests elsewhere: its rect
    // and its stand follow
    if (this.card.setTexture(texture) && this.cardRect) {
      this.standCard();
    }
  }

  setPedestalTexture(texture) {
    this.pedestal.setTexture(texture);
  }

  /**
   * Open it without a finger — the host's tap-to-open. On the ring it
   * chooses the front copy; holding the pack, it opens it.
   */
  autoSlice() {
    if (this.tracking) return;
    if (this.anim && this.anim.kind !== 'float' && this.anim.kind !== 'settle') return;
    if (this.stage === 'ring') {
      // A ring still settling is stopped where it is: the copy nearest the front is the one
      this.anim = null;
      this.emit(MESSAGES.INTERACTION_START);
      this.choose(this.turntable.nearest);
      // Opens as soon as the pack is up, without the second tap
      this.autoOpen = true;
      return;
    }
    if (this.stage === 'held') {
      this.emit(MESSAGES.INTERACTION_START);
      this.open();
    }
  }

  setEnabled(value) {
    this.enabled = !!value;
  }

  /* ── frame ── */

  animate(kind, duration, onDone, quiet = false) {
    this.anim = {kind, duration, elapsed: 0, onDone};
    if (!quiet) {
      this.emit(MESSAGES.PHASE, {name: kind, durationMs: duration});
    }
  }

  update(deltaMS) {
    this.clock += deltaMS;
    if (this.intro < 1) {
      this.intro = clamp(this.intro + deltaMS / this.o.motion.introMs, 0, 1);
      this.root.alpha = easeOut(this.intro);
    }
    this.pedestal.update(deltaMS);

    const c = this.o.carousel;
    const anim = this.anim;

    // The copies hover for as long as the ring is on the stage
    if (this.stage === 'ring' || anim?.kind === 'drop') {
      this.turntable.tick(deltaMS);
    }

    // The ring drifts whenever it is free to: not under a finger, not settling
    if (this.stage === 'ring' && !anim && !this.tracking && c.driftDps) {
      this.turntable.setAngle(this.turntable.angle + (c.driftDps * Math.PI / 180) * (deltaMS / 1000));
      this.noteStep();
    }

    if (!anim) return;
    anim.elapsed += deltaMS;
    const t = anim.duration > 0 ? clamp(anim.elapsed / anim.duration, 0, 1) : 0;

    switch (anim.kind) {
      case 'shuffle': {
        const eased = easeInOut(t);
        this.turntable.setAngle(this.shuffleFrom + this.shuffleDelta * eased);
        this.noteStep();
        break;
      }
      case 'settle': {
        this.turntable.setAngle(this.settleFrom + this.settleDelta * easeOut(t));
        this.noteStep();
        break;
      }
      case 'drop': {
        this.turntable.setDrop(easeInOut(t));
        break;
      }
      case 'rise': {
        const eased = easeOut(t);
        const to = this.heldRect();
        const from = this.riseFrom;
        const cx = to.left + to.width / 2;
        const cy = to.top + to.height / 2;
        this.held.x = from.x + (cx - from.x) * eased;
        this.held.y = from.y + (cy - from.y) * eased;
        this.held.width = from.w + (to.width - from.w) * eased;
        this.held.height = from.h + (to.height - from.h) * eased;
        this.held.alpha = 1;
        break;
      }
      case 'float': {
        // Held: a slow bob, forever if need be
        this.floatClock += deltaMS;
        const to = this.heldRect();
        const bob = Math.sin((this.floatClock / c.floatMs) * Math.PI * 2) * to.height * c.floatAmp;
        this.held.x = to.left + to.width / 2;
        this.held.y = to.top + to.height / 2 + bob;
        this.held.width = to.width;
        this.held.height = to.height;
        if (this.autoOpen) {
          this.autoOpen = false;
          this.open();
        }
        return;
      }
      case 'dissolve': {
        const eased = easeInOut(t);
        this.held.alpha = 1 - eased;
        // It grows a touch as it goes, like light leaving it
        const to = this.heldRect();
        const grow = 1 + eased * 0.08;
        this.held.width = to.width * grow;
        this.held.height = to.height * grow;
        // Nothing takes its place yet: the story is told on the bare stage,
        // and the card only appears with the flip
        this.card.setAlpha(0);
        break;
      }
      case 'facts': {
        const beats = this.story.beats;
        const step = c.factMs + c.factGapMs;
        for (let i = 0; i < beats; i++) {
          const local = (anim.elapsed - i * step) / c.factMs;
          this.story.showBeat(i, local);
        }
        break;
      }
      case 'banner': {
        this.bannerClock += deltaMS;
        // The story has been told: it goes as the strip arrives, and the
        // card, still face down, takes its place behind the strip
        const swap = clamp(anim.elapsed / STORY_SWAP_MS, 0, 1);
        this.story.setAlpha(1 - swap);
        this.card.setAlpha(swap);
        this.card.reveal('flip', 0);
        this.cardIn = true;
        const slide = clamp(anim.elapsed / c.bannerMs, 0, 1);
        this.story.showBanner(slide, this.bannerClock);
        // Off again over the last quarter of the hold
        const tail = (anim.elapsed - c.bannerMs) / c.bannerHoldMs;
        if (tail > 0.75) this.story.hideBanner((tail - 0.75) / 0.25);
        break;
      }
      case 'spinHold': {
        // Face down, turning on: a whole turn per hold. Without a banner
        // this is the first the stage sees of the card since the pack went
        this.card.setAlpha(1);
        this.cardIn = true;
        this.card.reveal('spinHold', t);
        this.story.setAlpha(1 - clamp(anim.elapsed / STORY_SWAP_MS, 0, 1));
        break;
      }
      case 'flip': {
        this.story.setAlpha(1 - clamp(anim.elapsed / (c.flipMs * 0.5), 0, 1));
        // A card the banner did not bring in comes in with the first frames
        // of the flip, face down; half a turn later the artwork faces out
        if (!this.cardIn) {
          this.card.setAlpha(clamp(anim.elapsed / (c.flipMs * 0.25), 0, 1));
        }
        this.card.reveal('flip', t);
        break;
      }
      case 'hold': {
        this.card.reveal('hold', t);
        break;
      }
      default:
        break;
    }

    if (anim.duration > 0 && t >= 1) {
      this.anim = null;
      anim.onDone?.();
    }
  }

  /* ── options / layout / lifecycle ── */

  setOptions(next) {
    const before = this.o;
    this.o = next;
    this.colors = sceneColors(next.theme);
    this.card.setOptions(next, this.colors);
    this.pedestal.setOptions(next);
    this.story.setOptions(next);
    this.turntable.setOptions(next);

    const baked =
      JSON.stringify(before.theme) !== JSON.stringify(next.theme) ||
      JSON.stringify(before.layout) !== JSON.stringify(next.layout) ||
      JSON.stringify(before.rest) !== JSON.stringify(next.rest) ||
      before.carousel.copies !== next.carousel.copies ||
      before.carousel.riseScale !== next.carousel.riseScale;

    if (!baked) {
      this.turntable.place();
      return true;
    }
    // Anything past the ring is laid out against the held pack: a rebuild
    // then would drop it back onto the ring
    if (this.anim || this.stage !== 'ring') {
      this.pendingRebuild = true;
      return false;
    }
    this.rebuild();
    return true;
  }

  resize() {
    if (this.anim || this.stage !== 'ring') {
      this.pendingRebuild = true;
      return;
    }
    this.rebuild();
  }

  rebuild() {
    this.pendingRebuild = false;
    this.rect = this.layoutRect(
      this.app.screen.width,
      this.app.screen.height,
      this.texture.width / this.texture.height,
    );
    this.turntable.layout(this.rect);
    if (this.card.built) {
      this.card.destroy();
      this.card.build(this.heldRect());
      this.card.rewind(this.heldRect());
      this.pedestal.rewind();
    }
    this.emit(MESSAGES.LAYOUT, {rect: this.rect});
  }

  reset() {
    if (this.pendingRebuild) {
      this.rebuild();
    }
    this.anim = null;
    this.stage = 'ring';
    this.locked = false;
    this.tracking = false;
    this.ignoring = false;
    this.down = null;
    this.moved = null;
    this.drag = null;
    this.autoOpen = false;
    this.artWaitStart = 0;
    this.floatClock = 0;
    this.bannerClock = 0;
    this.cardIn = false;
    this.turntable.reset();
    this.frontIndex = this.turntable.nearest;
    this.held.visible = false;
    this.held.alpha = 1;
    this.story.clear();
    this.card.rewind(this.heldRect());
    this.pedestal.rewind();
  }

  destroy() {
    this.story.destroy();
    this.turntable.destroy();
    this.root.destroy({children: true});
  }
}
