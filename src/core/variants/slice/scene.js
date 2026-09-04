/**
 * Pixi scene for the pack opening. It is the `slice` variant: the seal is cut
 * with a finger, the lid tears away and the card reveals itself.
 *
 * The scene knows nothing about where it runs. It draws, it reads the gesture
 * it is handed, and it reports what happened through `emit` — the host decides
 * whether that becomes a callback in a browser or a postMessage across a
 * WebView bridge. Everything around it lives in `core/createPackOpener`.
 */
import {Container} from 'pixi.js';
import {MESSAGES} from '../../config/protocol';
import {toNumber} from '../../runtime/color';
import {clamp, computePackRect, easeOut} from './geometry';
import {SliceHint} from './hint';
import {PackWrapper} from './wrapper';
import {RevealCard} from './card';

/* ─── scene ────────────────────────────────────────────────────────────── */

/** The three colours the card draws with, as Pixi wants them. */
const cardColors = theme => ({
  glow: toNumber(theme.glow),
  beam: toNumber(theme.beam),
  spark: toNumber(theme.spark),
});

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
    // Pack fades in instead of popping: no white flash, no jump from a
    // placeholder drawn with different geometry
    this.intro = 0;

    this.root = new Container();
    this.root.alpha = 0;
    app.stage.addChild(this.root);

    const aspect = texture.width / texture.height;
    this.rect = computePackRect(
      app.screen.width,
      app.screen.height,
      aspect,
      this.o.interaction,
      this.o.layout.pack,
    );

    this.wrapper = new PackWrapper(this.root, texture, this.rect);

    // Above the artwork — the hint has to stay readable over it
    this.hint = new SliceHint(toNumber(this.o.theme.hint));
    this.root.addChild(this.hint.view);

    this.card = new RevealCard(
      this.root,
      app.screen,
      this.o,
      cardColors(this.o.theme),
    );

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
   * slice into a slideshow.
   */
  get activity() {
    if (this.anim || this.dirty || this.tracking || this.intro < 1) {
      return 'busy';
    }
    return this.hint.alpha > 0 ? 'hint' : 'idle';
  }

  redraw() {
    this.wrapper.redraw(this.trail, this.dir, this.openness, this.o.interaction);
    this.dirty = false;
  }

  /* ── gesture ── */

  onDown(x, y) {
    if (!this.enabled || this.locked) {
      this.ignoring = true;
      return;
    }
    const {rect} = this;
    const inside =
      x >= rect.left - 16 &&
      x <= rect.right + 16 &&
      y >= rect.top - 16 &&
      y <= rect.bottom + 16;
    this.ignoring = !inside;
    if (this.ignoring) {
      return;
    }
    this.tracking = true;
    this.startX = x;
    this.startY = clamp(y, rect.cutTop, rect.cutBottom);
    this.started = false;
  }

  onMove(x, y) {
    if (this.ignoring || this.locked) {
      return;
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
    const py = clamp(y, rect.cutTop, rect.cutBottom);

    // A cut cannot be un-cut: the blade only ever moves forward
    if ((px - this.bladeX) * this.dir <= 0) {
      return;
    }
    const last = this.trail[this.trail.length - 1];
    if (
      this.trail.length < this.o.interaction.trailMaxPoints &&
      (px - last.x) * this.dir >= this.o.interaction.trailStep
    ) {
      this.trail.push({x: px, y: py});
    }
    this.bladeX = px;
    this.bladeY = py;

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
    if (this.ignoring || this.locked) {
      return;
    }
    if (this.progress > 0) {
      this.retract();
    }
  }

  /* ── phases ── */

  commit() {
    if (this.locked) {
      return;
    }
    this.locked = true;
    this.progress = 1;
    this.emit(MESSAGES.COMMITTED);
    // The blade runs out to the pack edge, then the lid tears away
    this.animate('runOut', this.o.motion.finishMs, () => this.openLid());
  }

  openLid() {
    this.prepareCard();
    this.openedPosted = false;
    this.animate('open', this.o.motion.open.ms, () =>
      this.animate('spin', this.o.motion.reveal.spinMs, () => this.startUnveil()),
    );
  }

  /* ── card reveal (replaces the old open_pack_video) ── */

  setCardTexture(texture) {
    this.card.setTexture(texture);
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

    this.card.park(this.cutY);
  }

  /** The artwork may still be downloading — wait for it, but not forever. */
  startUnveil() {
    if (!this.card.hasArt && !this.artWaitStart) {
      this.artWaitStart = Date.now();
    }
    const waited = this.artWaitStart ? Date.now() - this.artWaitStart : 0;
    if (!this.card.hasArt && waited < this.o.assets.card.timeoutMs) {
      this.animate('spin', this.o.motion.reveal.artWaitSpinMs, () =>
        this.startUnveil(),
      );
      return;
    }

    this.animate('unveil', this.o.motion.reveal.unveilMs, () =>
      this.animate('beam', this.o.motion.reveal.beamMs, () =>
        this.animate('hold', this.o.motion.reveal.holdMs, () =>
          this.emit(MESSAGES.REVEALED, {card: this.card.bounds()}),
        ),
      ),
    );
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
    this.animate('autoSlice', this.o.motion.autoSliceMs, () => this.openLid());
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
    this.card.setOptions(next, cardColors(next.theme));
    this.hint.setColor(toNumber(next.theme.hint));
    this.dirty = true;

    const baked =
      JSON.stringify(before.theme) !== JSON.stringify(next.theme) ||
      JSON.stringify(before.layout) !== JSON.stringify(next.layout) ||
      JSON.stringify(before.interaction.band) !==
        JSON.stringify(next.interaction.band);

    if (!baked) {
      this.redraw();
      return;
    }
    if (this.anim || this.started) {
      this.pendingRebuild = true;
      return;
    }
    this.rebuild();
  }

  /**
   * The stage changed size. Rebuilding mid-cut would strip the masks off the
   * trail and blank the revealed art, so a ceremony in flight keeps the pack it
   * started with and the new geometry rides on the next `reset()`.
   */
  resize() {
    if (this.anim || this.started) {
      this.pendingRebuild = true;
      return;
    }
    this.rebuild();
  }

  /** Re-derives the pack rect and the card, which bake options into textures. */
  rebuild() {
    this.pendingRebuild = false;
    this.rect = computePackRect(
      this.app.screen.width,
      this.app.screen.height,
      this.texture.width / this.texture.height,
      this.o.interaction,
      this.o.layout.pack,
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
    this.tracking = false;
    this.openedPosted = false;
    this.wrapper.reset();
    this.card.rewind(this.rect);
    this.artWaitStart = 0;
    this.dirty = true;
    this.redraw();
  }


  animate(kind, duration, onDone) {
    this.anim = {kind, duration, elapsed: 0, onDone};
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

  appendPoint(x, y) {
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
  }

  update(deltaMS) {
    this.updateIntro(deltaMS);
    this.updateHint(deltaMS);

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
        this.appendPoint(x, y);
        this.openness = 1;
        this.dirty = true;
      } else if (anim.kind === 'autoSlice') {
        const point = this.arcPoint(t);
        this.appendPoint(point.x, point.y);
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
        this.applyWrapperSink(t);
        this.card.slide(t);
        if (!this.openedPosted && lid >= 1) {
          this.openedPosted = true;
          this.emit(MESSAGES.OPENED);
        }
      } else if (anim.kind === 'retract') {
        this.openness = this.retractFrom * (1 - t);
        this.dirty = true;
      } else {
        // Card reveal phases draw their own layers, the wrapper masks are done
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
   */
  applyWrapperSink(t) {
    const open = this.o.motion.open;
    const lip = this.cutY + this.wrapper.sink(t, open);
    const freed = clamp((t - open.clipFrom) / (open.gone - open.clipFrom), 0, 1);
    this.card.clip(
      lip + (this.app.screen.height + this.card.height - lip) * freed,
    );
  }
}
