/**
 * Pixi scene for the pack opening. It is the `slice` variant: the seal is cut
 * with a finger, the lid tears away, the card rises out face down, gathers
 * itself in its colour and turns over.
 *
 * The scene knows nothing about where it runs. It draws, it reads the gesture
 * it is handed, and it reports what happened through `emit` — the host decides
 * whether that becomes a callback in a browser or a postMessage across a
 * WebView bridge. Everything around it lives in `core/createPackOpener`.
 */
import {Container} from 'pixi.js';
import {MESSAGES} from '../../config/protocol';
import {toNumber} from '../../runtime/color';
import {clamp, computeSliceRect, easeOut} from './geometry';
import {SliceEffects} from './effects';
import {SliceHint} from './hint';
import {CardPedestal} from '../shared/pedestal';
import {PackWrapper} from './wrapper';
import {RevealCard} from '../shared/card';
import {contentBoundsOf} from '../shared/textures';

/* ─── scene ────────────────────────────────────────────────────────────── */

/** The colours the scene draws with, as Pixi wants them. */
const sceneColors = theme => ({
  glow: toNumber(theme.glow),
  beam: toNumber(theme.beam),
  spark: toNumber(theme.spark),
  seam: toNumber(theme.seam),
  rim: toNumber(theme.rim),
});

/** Options that are baked into the pack's own light: a change to them is a rebuild. */
const BAKED_SLICE = ['foilWidth', 'backlightSpread'];

export class PackScene {
  /**
   * `options` arrives already resolved — filling defaults in is the variant
   * registry's job, not the scene's. `emit(type, payload)` is how the scene
   * talks back: a plain callback, so the host is free to turn it into a bridge
   * message or a DOM event.
   */
  constructor(app, texture, options, emit) {
    this.app = app;
    this.texture = texture;
    this.emit = emit || (() => {});
    this.o = options;
    this.colors = sceneColors(options.theme);

    this.trail = [];
    this.dir = 0;
    this.progress = 0;
    this.openness = 0;
    this.release = 0;
    this.locked = false;
    this.enabled = true;
    this.tracking = false;
    this.startX = 0;
    this.startY = 0;
    this.maxAdvance = 0;
    this.needAdvance = 1;
    this.lastTick = 0;
    this.dirty = true;
    this.chargeClock = 0;
    this.landClock = 0;
    // Pack fades in instead of popping: no white flash, no jump from a
    // placeholder drawn with different geometry
    this.intro = 0;

    this.root = new Container();
    this.root.alpha = 0;
    app.stage.addChild(this.root);

    // Where the pack is inside its artwork — laid out by that, not the image
    this.bounds = contentBoundsOf(texture);
    this.rect = this.layoutRect(
      app.screen.width,
      app.screen.height,
      texture.width / texture.height,
    );

    this.wrapper = new PackWrapper(this.root, texture, this.rect, this.o);
    this.effects = new SliceEffects(this.wrapper, this.root);

    // Above the artwork — the hint has to stay readable over it
    this.hint = new SliceHint(toNumber(this.o.theme.hint));
    this.wrapper.carry(this.hint.view);

    this.card = new RevealCard(this.root, app.screen, this.o, this.colors);
    this.card.useDepth(app.renderer);
    this.pedestal = new CardPedestal(this.root, this.o);

    this.redraw();
  }

  get points() {
    return this.trail;
  }

  /**
   * Drives the engine's frame cap. `dirty` counts as busy: the masks are one
   * redraw behind, and dropping to a sleeping frame rate before that lands
   * would leave the pack half-cut on screen. A finger on the glass counts too —
   * the cut is redrawn between moves, and a sleeping ticker turns a smooth
   * slice into a slideshow. So do sparks and embers still in the air. The
   * untouched pack floats and catches the light, which is slow but alive.
   */
  get activity() {
    if (
      this.anim ||
      this.dirty ||
      this.tracking ||
      this.intro < 1 ||
      this.effects.busy
    ) {
      return 'busy';
    }
    if (!this.started && !this.locked) {
      return 'hint';
    }
    return this.hint.alpha > 0 ? 'hint' : 'idle';
  }

  redraw() {
    this.wrapper.redraw(this.trail, this.dir, this.openness, this.o.interaction);
    this.dirty = false;
  }

  /* ── gesture ── */

  /** The finger on the stage, in the pack's own space — the pack may be floating. */
  local(y) {
    return y - this.wrapper.offsetY;
  }

  /** Whether a point on the stage is on the pack, give or take a fingertip. */
  over(x, y) {
    const {rect} = this;
    const ly = this.local(y);
    return (
      x >= rect.left - 16 &&
      x <= rect.right + 16 &&
      ly >= rect.top - 16 &&
      ly <= rect.bottom + 16
    );
  }

  /** The finger is on the pack: the cut starts from here once it moves. */
  arm(x, y) {
    const {rect} = this;
    this.armed = true;
    this.tracking = true;
    this.startX = x;
    this.startY = clamp(this.local(y), rect.cutTop, rect.cutBottom);
  }

  onDown(x, y) {
    if (!this.enabled || this.locked) {
      this.ignoring = true;
      return;
    }
    this.ignoring = false;
    this.started = false;
    this.armed = false;
    // A finger that comes down beside the pack and slides onto it cuts from
    // where it reaches it — turned away at the touch, it moved over the pack
    // and nothing happened, which read as the cut being broken
    if (this.over(x, y)) {
      this.arm(x, y);
    }
  }

  onMove(x, y) {
    if (this.ignoring || this.locked) {
      return;
    }
    if (!this.armed) {
      if (!this.over(x, y)) {
        return;
      }
      this.arm(x, y);
    }
    const {rect} = this;

    if (!this.started) {
      if (Math.abs(x - this.startX) < this.o.interaction.activation) {
        return;
      }
      this.started = true;
      this.dir = x >= this.startX ? 1 : -1;
      this.trail = [{x: this.startX, y: this.startY}];
      this.bladeX = this.startX;
      this.bladeY = this.startY;

      // Starting near an edge leaves less room, so ask for less travel
      const reach =
        this.dir > 0 ? rect.right - this.startX : this.startX - rect.left;
      this.needAdvance = Math.max(
        Math.min(rect.width * this.o.interaction.completeFraction, reach * 0.85),
        rect.width * 0.28,
      );
      this.emit(MESSAGES.INTERACTION_START);
    }

    const px = clamp(x, rect.left - 12, rect.right + 12);
    const py = clamp(this.local(y), rect.cutTop, rect.cutBottom);

    // A cut cannot be un-cut: the blade only ever moves forward
    if ((px - this.bladeX) * this.dir <= 0) {
      return;
    }
    this.moveBlade(px, py);

    this.maxAdvance = Math.max(
      this.maxAdvance,
      (px - this.startX) * this.dir,
    );
    this.progress = clamp(this.maxAdvance / this.needAdvance, 0, 1);
    this.openness = this.progress;
    this.dirty = true;

    if (this.progress - this.lastTick >= this.o.interaction.tickStep) {
      this.lastTick = this.progress;
      this.emit(MESSAGES.TICK, {progress: this.progress});
    }

    if (this.progress >= 1) {
      this.commit();
    }
  }

  onUp() {
    this.tracking = false;
    this.armed = false;
    if (this.ignoring || this.locked) {
      return;
    }
    if (this.progress > 0) {
      this.retract();
    }
  }

  /**
   * The blade to a new point of the cut, recorded into the trail at its
   * sampling step, throwing sparks for the way it came.
   */
  moveBlade(x, y) {
    const travel = Math.abs(x - this.bladeX);
    const last = this.trail[this.trail.length - 1];
    if (
      this.trail.length < this.o.interaction.trailMaxPoints &&
      last &&
      (x - last.x) * this.dir >= this.o.interaction.trailStep
    ) {
      this.trail.push({x, y});
    }
    this.bladeX = x;
    this.bladeY = y;
    this.effects.bladeSparks(
      x,
      y + this.wrapper.offsetY,
      travel,
      this.dir,
      this.o.slice,
      this.colors,
    );
  }

  /* ── phases ── */

  commit() {
    if (this.locked) {
      return;
    }
    this.locked = true;
    this.progress = 1;
    this.emit(MESSAGES.COMMITTED);
    this.effects.burst(this.trail, this.o.slice, this.colors, this.wrapper.offsetY);
    // The blade runs out to the pack edge, then the lid tears away
    this.animate('runOut', this.o.motion.finishMs, () => this.openLid());
  }

  openLid() {
    this.prepareCard();
    this.openedPosted = false;
    this.animate('open', this.o.motion.open.ms, () => this.startCharge());
  }

  setCardTexture(texture) {
    // Built again to the artwork's shape, the card rests elsewhere: its stand
    // follows
    if (this.card.setTexture(texture) && this.card.placed) {
      this.buildPedestal();
    }
  }

  setPedestalTexture(texture) {
    this.pedestal.setTexture(texture);
  }

  /**
   * The stand goes under where the card comes to rest — the middle of the
   * stage — not under where it starts, so it stays put while the card slides
   * out past the lip.
   */
  buildPedestal() {
    const rect = this.card.bounds();

    this.pedestal.build(rect.left + rect.width / 2, rect.bottom, rect.width);
  }

  /** Everything the slide-out needs, resolved before the timeline starts. */
  prepareCard() {
    if (!this.card.built) {
      this.card.build(this.rect);
    }

    // Height of the cut, averaged over the trail — the lip the card slides past
    const trail = this.trail;
    this.cutY = trail.length
      ? trail.reduce((sum, point) => sum + point.y, 0) / trail.length
      : this.rect.top + this.rect.height * this.o.interaction.band.top;

    this.card.park(this.cutY, this.rect);
    // After parking, not before: parking is what fixes where the card lands,
    // and the stand is placed against that
    this.buildPedestal();
  }

  /** The card is out, face down: it gathers itself before it turns. */
  startCharge() {
    this.chargeClock = 0;
    this.animate('charge', this.o.slice.chargeMs, () => this.afterCharge());
  }

  /**
   * The artwork may still be downloading — wait for it, but not forever. The
   * wait is the charge held at its peak, one loop per hold, so however many
   * holds it takes read as one unbroken build-up; the host hears `chargeHold`
   * once, when the wait begins, and nothing for the holds after.
   */
  afterCharge() {
    // The first hold is the one the host hears; the holds after it continue it
    const firstHold = !this.card.hasArt && !this.artWaitStart;
    if (firstHold) {
      this.artWaitStart = Date.now();
    }
    const waited = this.artWaitStart ? Date.now() - this.artWaitStart : 0;
    if (!this.card.hasArt && waited < this.o.assets.card.timeoutMs) {
      this.animate(
        'chargeHold',
        this.o.slice.chargeWaitMs,
        () => this.afterCharge(),
        !firstHold,
      );
      return;
    }
    this.card.beginFlip();
    this.animate('flip', this.o.slice.flipMs, () => this.land());
  }

  /**
   * Face up and down: the host feels it land, the stand comes in under it and
   * embers start up past it. A card that turned where the pack was gets its
   * stand once it has risen onto it.
   */
  land() {
    this.emit(MESSAGES.IMPACT);
    const lifts = this.card.lifts;
    if (!lifts) {
      this.pedestal.reveal();
    }
    this.effects.startEmbers(this.card.bounds(), this.o.slice);
    this.landClock = 0;
    this.animate('land', this.o.slice.landMs, () => {
      if (lifts) {
        this.pedestal.reveal();
      }
      this.card.hideTwinkles();
      this.animate('hold', this.o.motion.reveal.holdMs, () =>
        this.emit(MESSAGES.REVEALED, {
          card: this.card.bounds(),
          pedestal: this.pedestal.bounds(),
        }),
      );
    });
  }

  retract() {
    this.animate('retract', this.o.motion.retractMs, () => {
      this.trail = [];
      this.dir = 0;
      this.progress = 0;
      this.openness = 0;
      this.maxAdvance = 0;
      this.lastTick = 0;
      this.started = false;
      this.dirty = true;
      this.emit(MESSAGES.RETRACTED);
    });
  }

  /** Point on the synthetic slice arc used by the tap-to-open fallback. */
  arcPoint(t) {
    const {rect} = this;
    const arc = this.o.interaction.autoArc;
    const x0 = rect.left + rect.width * arc.inset;
    const x1 = rect.right - rect.width * arc.inset;
    const y0 = rect.top + rect.height * arc.fromY;
    const y1 = rect.top + rect.height * arc.toY;
    const cx = (x0 + x1) / 2;
    const cy = rect.top + rect.height * arc.controlY;
    const mt = 1 - t;

    return {
      x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
      y: mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
    };
  }

  autoSlice() {
    if (this.locked) {
      return;
    }
    this.locked = true;
    this.dir = 1;
    const start = this.arcPoint(0);
    this.trail = [start];
    this.bladeX = start.x;
    this.bladeY = start.y;
    this.emit(MESSAGES.INTERACTION_START);
    this.animate('autoSlice', this.o.motion.autoSliceMs, () => {
      this.effects.burst(this.trail, this.o.slice, this.colors, this.wrapper.offsetY);
      this.openLid();
    });
  }

  setEnabled(value) {
    this.enabled = !!value;
  }

  /**
   * Only the scene graph — the renderer belongs to the host, which tears it
   * down itself. Keeps the variant safe to swap out without dropping the app.
   */
  destroy() {
    this.root.destroy({children: true});
  }

  /**
   * Applies new options to a live scene. Numbers and colours land immediately —
   * the scene reads them where it uses them — but anything baked into a texture
   * or into the pack rect waits for the next `reset()`: rebuilding the card
   * mid-ceremony would strip the masks off the trail and blank the revealed art.
   */
  setOptions(next) {
    const before = this.o;
    this.o = next;
    this.colors = sceneColors(next.theme);
    this.card.setOptions(next, this.colors);
    this.pedestal.setOptions(next);
    this.wrapper.setOptions(next);
    this.hint.setColor(toNumber(next.theme.hint));
    this.dirty = true;

    const baked =
      JSON.stringify(before.theme) !== JSON.stringify(next.theme) ||
      JSON.stringify(before.layout) !== JSON.stringify(next.layout) ||
      JSON.stringify(before.rest) !== JSON.stringify(next.rest) ||
      JSON.stringify(before.interaction.band) !==
        JSON.stringify(next.interaction.band) ||
      BAKED_SLICE.some(key => before.slice[key] !== next.slice[key]);

    if (!baked) {
      this.redraw();
      return true;
    }
    // `locked` covers a ceremony that has played out and is waiting for
    // `reset()`: rebuilding then would rewind the revealed card into the pack.
    // The false return tells the host the change is waiting on that reset
    if (this.anim || this.started || this.locked) {
      this.pendingRebuild = true;
      return false;
    }
    this.rebuild();
    return true;
  }

  /**
   * The stage changed size. Rebuilding mid-cut would strip the masks off the
   * trail and blank the revealed art, so a ceremony in flight keeps the pack it
   * started with and the new geometry rides on the next `reset()`.
   */
  resize() {
    // `locked` covers a ceremony that has played out and is waiting for
    // `reset()`: rebuilding then would rewind the revealed card into the pack
    if (this.anim || this.started || this.locked) {
      this.pendingRebuild = true;
      return;
    }
    this.rebuild();
  }

  /**
   * The pack's box. With `layout.pack.anchor: 'card'` the pack is placed so
   * its centre is where the card will come to rest — sized on a first pass,
   * then moved — so the cut does not hoist the card up out of the pack's
   * place. The default keeps it centred in the band the host left free,
   * nudged by `offsetY`.
   */
  layoutRect(width, height, aspect) {
    const {pack, stage} = this.o.layout;
    const {interaction} = this.o;
    const sized = computeSliceRect(
      width,
      height,
      aspect,
      interaction,
      pack,
      stage,
      undefined,
      this.bounds,
    );
    if (pack.anchor !== 'card') {
      return sized;
    }
    const anchorY = RevealCard.restingCentre({width, height}, sized, this.o);
    return computeSliceRect(
      width,
      height,
      aspect,
      interaction,
      pack,
      stage,
      anchorY,
      this.bounds,
    );
  }

  /** Re-derives the pack rect and the card, which bake options into textures. */
  rebuild() {
    this.pendingRebuild = false;
    this.rect = this.layoutRect(
      this.app.screen.width,
      this.app.screen.height,
      this.texture.width / this.texture.height,
    );
    this.wrapper.layout(this.rect);
    if (this.card.built) {
      this.card.destroy();
      this.card.build(this.rect);
      this.card.rewind(this.rect);
    }
    this.dirty = true;
    this.redraw();
    // Whatever the host hangs off the pack — a hint, a slot — moved with it
    this.emit(MESSAGES.LAYOUT, {rect: this.rect});
  }

  reset() {
    if (this.pendingRebuild) {
      this.rebuild();
    }
    this.anim = null;
    this.trail = [];
    this.dir = 0;
    this.progress = 0;
    this.openness = 0;
    this.release = 0;
    this.maxAdvance = 0;
    this.lastTick = 0;
    this.locked = false;
    this.started = false;
    this.ignoring = false;
    this.armed = false;
    this.tracking = false;
    this.openedPosted = false;
    this.chargeClock = 0;
    this.landClock = 0;
    this.root.y = 0;
    this.wrapper.reset();
    this.effects.reset();
    this.card.rewind(this.rect);
    this.pedestal.rewind();
    this.artWaitStart = 0;
    this.dirty = true;
    this.redraw();
  }

  animate(kind, duration, onDone, quiet = false) {
    this.anim = {kind, duration, elapsed: 0, onDone};
    // `quiet`: a phase that continues the one before it (another hold of
    // the same charge) is not announced again
    if (!quiet) {
      this.emit(MESSAGES.PHASE, {name: kind, durationMs: duration});
    }
    if (kind === 'runOut') {
      const n = this.trail.length;
      const last = this.trail[n - 1] ?? {x: this.bladeX, y: this.bladeY};
      const prev = this.trail[Math.max(0, n - 2)] ?? last;
      const dx = last.x - prev.x;
      this.runOutFrom = {
        x: this.bladeX,
        y: this.bladeY,
        slope:
          dx !== 0
            ? clamp(
                (last.y - prev.y) / dx,
                -this.o.interaction.finishSlopeLimit,
                this.o.interaction.finishSlopeLimit,
              )
            : 0,
        targetX:
          this.dir > 0
            ? this.rect.right +
              this.rect.width * this.o.interaction.finishOvershoot
            : this.rect.left -
              this.rect.width * this.o.interaction.finishOvershoot,
      };
    }
    if (kind === 'retract') {
      this.retractFrom = this.openness;
    }
  }

  update(deltaMS) {
    const fx = this.o.slice;
    this.updateIntro(deltaMS);
    this.updateHint(deltaMS);
    this.wrapper.update(
      deltaMS,
      {touched: this.tracking || this.started || this.locked, opened: this.locked},
      this.colors,
    );
    this.pedestal.update(deltaMS);
    this.effects.update(deltaMS, fx, this.colors);

    const anim = this.anim;
    if (anim) {
      anim.elapsed += deltaMS;
      const t = clamp(anim.elapsed / anim.duration, 0, 1);

      if (anim.kind === 'runOut') {
        const from = this.runOutFrom;
        const eased = 1 - (1 - t) * (1 - t);
        const x = from.x + (from.targetX - from.x) * eased;
        const y = clamp(
          from.y + from.slope * (x - from.x),
          this.rect.cutTop,
          this.rect.cutBottom,
        );
        this.moveBlade(x, y);
        this.openness = 1;
        this.dirty = true;
        this.wrapper.setJolt(t);
      } else if (anim.kind === 'autoSlice') {
        const point = this.arcPoint(t);
        this.moveBlade(point.x, point.y);
        this.progress = t;
        this.openness = t;
        this.dirty = true;
        if (t - this.lastTick >= this.o.interaction.tickStep) {
          this.lastTick = t;
          this.emit(MESSAGES.TICK, {progress: t});
        }
      } else if (anim.kind === 'open') {
        // Masks are frozen from here on — only transforms move
        const lid = clamp(t / this.o.motion.open.lid, 0, 1);
        this.release = easeOut(lid);
        this.applyLid();
        const drop = this.applyWrapperSink(t);
        this.card.slide(t, fx.riseBloom, this.colors.seam);
        // The light pouring out of the opened pack swells with the lid and
        // fades as the card clears it
        this.effects.pourAt(
          this.rect,
          this.cutY + drop,
          this.release * (1 - clamp((t - 0.45) / 0.5, 0, 1)),
          fx,
          this.colors,
        );
        if (!this.openedPosted && lid >= 1) {
          this.openedPosted = true;
          this.emit(MESSAGES.OPENED);
        }
      } else if (anim.kind === 'retract') {
        this.openness = this.retractFrom * (1 - t);
        this.dirty = true;
      } else if (anim.kind === 'charge' || anim.kind === 'chargeHold') {
        this.chargeClock += deltaMS;
        // The build-up is over once the first pass is; a hold keeps it at its peak
        this.card.charge(
          anim.kind === 'charge' ? t : 1,
          this.chargeClock,
          fx,
          this.colors,
        );
      } else if (anim.kind === 'flip') {
        this.card.flipOver(t, fx, this.colors);
      } else if (anim.kind === 'land') {
        this.landClock += deltaMS;
        this.card.land(t, this.landClock, fx);
        // The stage takes the hit with the card: a short knock, settled well
        // before the card reports where it came to rest
        const knock = clamp(this.landClock / 320, 0, 1);
        this.root.y =
          fx.landShake * Math.sin(knock * Math.PI * 3) * Math.pow(1 - knock, 2);
      } else {
        this.card.reveal(anim.kind, t);
      }

      if (t >= 1) {
        this.anim = null;
        anim.onDone?.();
      }
    }

    if (this.dirty) {
      this.redraw();
    }
    this.drawLight();
  }

  /**
   * The point of light under the blade, redrawn every frame the blade moves,
   * and the pour put out whenever the pack is not opening.
   */
  drawLight() {
    const fx = this.o.slice;
    const kind = this.anim?.kind;
    const cutting =
      (this.tracking && this.started && !this.locked) ||
      kind === 'runOut' ||
      kind === 'autoSlice';
    // Only over the foil: the blade runs out past the pack's side
    const onPack =
      this.bladeX >= this.rect.left && this.bladeX <= this.rect.right;
    this.effects.showBlade(
      cutting && onPack ? {x: this.bladeX, y: this.bladeY} : null,
      fx,
      this.colors,
    );
    if (kind !== 'open') {
      this.effects.pourAt(this.rect, 0, 0, fx, this.colors);
    }
  }

  updateIntro(deltaMS) {
    if (this.intro >= 1) {
      return;
    }
    this.intro = clamp(this.intro + deltaMS / this.o.motion.introMs, 0, 1);
    this.root.alpha = easeOut(this.intro);
  }

  /** Runs the hint loop while the pack is untouched, fades it out on contact. */
  updateHint(deltaMS) {
    this.hint.update(deltaMS, this.rect, this.o.hint, this.started || this.locked);
  }

  applyLid() {
    this.wrapper.applyLid(this.release, this.dir, this.o.motion.open);
  }

  /**
   * The sunken wrapper and the clip that hides whatever part of the card is
   * still behind its lip. The wrapper hands back the drop it used, so the two
   * cannot disagree for a frame — when they did, the wrapper visibly jumped.
   * The drop is handed on, for what rides the lip.
   */
  applyWrapperSink(t) {
    const open = this.o.motion.open;
    const drop = this.wrapper.sink(t, open);
    const lip = this.cutY + drop;
    const freed = clamp((t - open.clipFrom) / (open.gone - open.clipFrom), 0, 1);
    this.card.clip(
      lip + (this.app.screen.height + this.card.height - lip) * freed,
    );
    return drop;
  }
}
