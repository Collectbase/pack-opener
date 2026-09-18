/**
 * Pixi scene for the `burst` mechanic: a finger holds the pack down, the
 * pressure builds while it stays there, and the wrapper goes off — a flash,
 * shreds of foil, and the card climbing out of the light.
 *
 * Where `slice` asks for a skill (cut the seal cleanly), this asks for nerve
 * (hold it until it goes). And it answers itself: the wrapper is torn into
 * pieces, then the card is put together out of pieces — dust gathers, resolves
 * into fragments of the artwork and flies into place. Nothing of the cut
 * mechanic's finish is reused, because a second animation that ends in the same
 * spinning card back is not a second animation.
 *
 * Like every variant it knows nothing about where it runs. It draws, it reads
 * the gesture it is handed, and it reports what happened through `emit`.
 */
import {Container} from 'pixi.js';
import {MESSAGES} from '../../config/protocol';
import {toNumber} from '../../runtime/color';
import {CardPedestal} from '../shared/pedestal';
import {RevealCard} from '../shared/card';
import {clamp, computePackRect} from '../shared/geometry';
import {ScreenFlash} from '../shared/blast';
import {CardAssembly} from './assemble';
import {BlastEffects} from './effects';
import {ChargingPack} from './pack';
import {BurstFlash, BurstShards} from './shards';

/** How far outside the pack a finger still counts as being on it. */
const TOUCH_SLOP = 16;

const sceneColors = theme => ({
  glow: toNumber(theme.glow),
  beam: toNumber(theme.beam),
  spark: toNumber(theme.spark),
});

export class BurstScene {
  constructor(app, texture, options, emit) {
    this.app = app;
    this.texture = texture;
    this.emit = emit || (() => {});
    this.o = options;
    this.colors = sceneColors(options.theme);

    this.clock = 0;
    // Pack fades in instead of popping, as in every variant
    this.intro = 0;
    this.charge = 0;
    this.lastTick = 0;
    this.tracking = false;
    this.locked = false;
    this.blasted = false;
    this.enabled = true;
    this.ignoring = false;
    this.artWaitStart = 0;
    this.handed = false;
    this.sheenAt = null;

    this.root = new Container();
    this.root.alpha = 0;
    app.stage.addChild(this.root);

    this.rect = computePackRect(
      app.screen.width,
      app.screen.height,
      texture.width / texture.height,
      this.o.layout.pack,
    );

    this.pack = new ChargingPack(this.root, texture, this.rect, this.o.theme);
    this.shards = new BurstShards(this.root, texture, this.rect, this.o.burst);
    // Above both: its job is to cover the frame where one becomes the other
    this.flash = new BurstFlash(this.root, this.rect, this.o.theme, this.o.burst);

    this.effects = new BlastEffects(this.root, this.o.burst);
    this.effects.layout(this.rect);

    this.card = new RevealCard(this.root, app.screen, this.o, this.colors);
    this.pedestal = new CardPedestal(this.root, this.o);
    this.assembly = new CardAssembly(this.root, this.o.theme);

    // Over everything, the card included: the flash is the stage being hit,
    // not something happening on it
    this.screenFlash = new ScreenFlash(this.root);
    this.screenFlash.layout(app.screen);

    // What is left of the current kick, in ms
    this.kick = 0;
    this.kickMs = 1;
    this.kickAmp = 0;

    // Time since the wrapper went off, or null when nothing has. The blast
    // outlives the phase that starts it: its debris is still falling while the
    // card gathers, and its glitter is still drifting when the card lands.
    this.blastClock = null;
  }

  /**
   * Drives the engine's frame cap. A finger on the glass counts as busy even
   * before the charge starts moving — the shudder is redrawn every frame, and a
   * sleeping ticker turns it into a stutter exactly when the tension peaks.
   */
  get activity() {
    if (
      this.anim ||
      this.tracking ||
      this.charge > 0 ||
      this.intro < 1 ||
      this.blastClock !== null
    ) {
      return 'busy';
    }
    // The untouched pack breathes; once it is gone nothing moves on its own
    return this.blasted ? 'idle' : 'hint';
  }

  /* ── gesture ── */

  onDown(x, y) {
    if (!this.enabled || this.locked) {
      this.ignoring = true;
      return;
    }
    const {rect} = this;
    const inside =
      x >= rect.left - TOUCH_SLOP &&
      x <= rect.right + TOUCH_SLOP &&
      y >= rect.top - TOUCH_SLOP &&
      y <= rect.bottom + TOUCH_SLOP;
    this.ignoring = !inside;
    if (this.ignoring) {
      return;
    }

    this.tracking = true;
    // Contact is the start of the charge, so the host hears about it here
    // rather than after some threshold — there is no threshold to cross
    this.emit(MESSAGES.INTERACTION_START);
  }

  /**
   * The charge is a clock, not a distance: a finger that wanders — and one
   * pressing hard on glass always does — must not change what is being asked
   * of it. Nothing to read from a move.
   */
  onMove() {}

  onUp() {
    this.tracking = false;
    if (this.ignoring || this.locked) {
      return;
    }
    if (this.charge > 0) {
      this.releaseCharge();
    }
  }

  /* ── phases ── */

  /** Pressure bleeding back out of a pack that was let go too early. */
  releaseCharge() {
    this.releaseFrom = this.charge;
    this.animate('release', this.o.charge.releaseMs, () => {
      this.charge = 0;
      this.lastTick = 0;
      this.emit(MESSAGES.RETRACTED);
    });
  }

  /**
   * Full charge. The wrapper stops existing inside the flash: the pack is
   * hidden and the shreds take over in the same frame, which is only allowed
   * because the flash is over both of them.
   */
  commit() {
    if (this.blasted) {
      return;
    }
    this.locked = true;
    this.blasted = true;
    this.charge = 1;
    this.emit(MESSAGES.COMMITTED);

    this.prepareCard();
    this.pack.hide();
    this.emit(MESSAGES.OPENED);

    // The visuals of the blast run on their own clock from here; this phase is
    // only the beat of quiet that separates them from the card gathering
    this.blastClock = 0;
    this.strike(this.o.burst.kickMs, this.o.burst.kickAmp);
    this.animate('beat', this.o.burst.beatMs, () => this.startSwarm());
  }

  /**
   * Everything the finish needs, resolved before the timeline starts. The card
   * is built but never shown: the assembly draws the pieces, and the card
   * itself only appears once they have all landed.
   */
  prepareCard() {
    if (!this.card.built) {
      this.card.build(this.rect);
    }
    this.card.place(this.rect);
    this.cardRect = this.card.bounds();
    this.pedestal.build(
      this.cardRect.left + this.cardRect.width / 2,
      this.cardRect.bottom,
      this.cardRect.width,
    );
  }

  setPedestalTexture(texture) {
    this.pedestal.setTexture(texture);
  }

  setCardTexture(texture) {
    this.card.setTexture(texture);
    // The pieces are cut from the artwork, so a card that arrived late has to
    // be cut now — mid-assembly it would leave half the pieces blank
    if (!this.anim || this.anim.kind !== 'assemble') {
      this.buildAssembly();
    }
  }

  buildAssembly() {
    if (!this.cardRect) {
      return;
    }
    // Also called while the artwork is still downloading: the rect alone is
    // what the waiting cloud turns around, and `build` cuts pieces only once
    // there is a texture to cut them from. Skipping it left the assembly
    // without a centre, and the cloud's first frame took the whole ticker down
    this.assembly.build(this.cardRect, this.card.texture, this.o.burst);
  }

  /**
   * The dust cloud. It is where the artwork's download hides: the cloud is
   * already card-shaped, so waiting reads as the card gathering rather than as
   * a spinner. A card that is already in hand still gets one short pass of it,
   * because the pieces have to come from somewhere.
   */
  startSwarm() {
    if (!this.artWaitStart) {
      this.artWaitStart = Date.now();
    }
    this.buildAssembly();

    this.animate('swarm', this.o.burst.swarmMs, () => {
      const waited = Date.now() - this.artWaitStart;
      // Still nothing to cut pieces from: keep the cloud turning, but not past
      // the deadline the host set for the artwork
      if (!this.assembly.built && waited < this.o.assets.card.timeoutMs) {
        this.startSwarm();
        return;
      }
      this.startAssemble();
    });
  }

  /**
   * A hit the hand feels: the whole stage thrown off centre and shaken back.
   * Costs one position write a frame and does more for a blast than any number
   * of particles.
   */
  strike(ms, amp) {
    this.kick = ms;
    this.kickMs = ms;
    this.kickAmp = amp * this.rect.width;
  }

  updateKick(deltaMS) {
    if (this.kick <= 0) {
      if (this.root.x !== 0 || this.root.y !== 0) {
        this.root.position.set(0, 0);
      }
      return;
    }
    this.kick = Math.max(0, this.kick - deltaMS);
    // Squared falloff, so it dies away rather than stopping
    const left = this.kick / this.kickMs;
    const amp = this.kickAmp * left * left;
    const phase = (this.clock / 1000) * this.o.burst.kickHz * Math.PI * 2;
    this.root.position.set(
      Math.sin(phase) * amp,
      Math.cos(phase * 1.37) * amp * 0.6,
    );
  }

  /**
   * The pieces flying in, the light that marks them landing, and the finished
   * card. `snap` is where the assembly hands over to the card itself: one push
   * out and back, so it lands instead of appearing.
   */
  startAssemble() {
    this.handed = false;
    this.animate('assemble', this.o.burst.assembleMs, () => {
      this.animate('snap', this.o.burst.snapMs, () => {
        this.assembly.hide();
        this.animate('settle', this.o.motion.reveal.holdMs, () =>
          this.emit(MESSAGES.REVEALED, {
            card: this.card.bounds(),
            pedestal: this.pedestal.bounds(),
          }),
        );
      });
    });
  }

  /**
   * The card coming up underneath the pieces over the last of the assembly.
   * It is what closes the hairlines between them — and it means the finished
   * artwork is already there when they dissolve, instead of replacing them.
   */
  handOver(alpha) {
    if (!this.handed) {
      this.handed = true;
      this.card.revealInstant();
    }
    this.card.setAlpha(alpha);
    // Behind the card it hands over to, never with it
    this.pedestal.reveal();
  }

  /** Charge it without a finger — the host's tap-to-open fallback. */
  autoSlice() {
    if (this.locked) {
      return;
    }
    this.locked = true;
    this.emit(MESSAGES.INTERACTION_START);
    this.animate('autoCharge', this.o.charge.holdMs, () => this.commit());
  }

  setEnabled(value) {
    this.enabled = !!value;
  }

  /* ── frame ── */

  animate(kind, duration, onDone) {
    this.anim = {kind, duration, elapsed: 0, onDone};
  }

  update(deltaMS) {
    this.clock += deltaMS;
    this.updateIntro(deltaMS);
    this.updateCharge(deltaMS);
    this.pedestal.update(deltaMS);

    const anim = this.anim;
    if (anim) {
      anim.elapsed += deltaMS;
      const t = clamp(anim.elapsed / anim.duration, 0, 1);

      if (anim.kind === 'autoCharge') {
        this.charge = t;
        this.reportCharge();
      } else if (anim.kind === 'release') {
        this.charge = this.releaseFrom * (1 - t);
      } else if (anim.kind === 'swarm') {
        this.assembly.swarm(t, this.clock, this.o.burst, this.colors);
      } else if (anim.kind === 'assemble') {
        this.assembly.play(t, this.o.burst, this.colors);
        // The halo comes up with the card rather than after it
        this.card.setHalo(t);
        const from = this.o.burst.handoverFrom;
        if (t >= from) {
          this.handOver(clamp((t - from) / (1 - from), 0, 1));
        }
      } else if (anim.kind === 'snap') {
        // Nothing is thrown at the card here: whatever happens, happens to the
        // card itself. Its own outline flares, and a highlight runs across the
        // artwork — loud, but made of the card rather than aimed at it
        const push = Math.sin(Math.PI * t) * this.o.burst.snapOvershoot;
        this.handOver(1);
        this.card.setScale(1 + push);
        this.card.pulse(Math.sin(Math.PI * Math.pow(t, 0.7)));
        if (this.sheenAt === null) {
          this.sheenAt = this.clock;
        }
        // The pieces go with the same push, then dissolve off the artwork
        this.assembly.settle(
          1 - clamp(t / this.o.burst.dissolveSpan, 0, 1),
          1 + push,
        );
      } else if (anim.kind === 'settle') {
        this.card.setScale(1);
        this.card.pulse(0);
      }

      if (t >= 1) {
        this.anim = null;
        anim.onDone?.();
      }
    }

    this.updateKick(deltaMS);
    if (this.sheenAt !== null) {
      this.card.sweepSheen(
        (this.clock - this.sheenAt) / this.o.motion.reveal.sheenMs,
      );
    }

    // The wrapper is only worth drawing while it still exists
    if (!this.blasted) {
      this.pack.apply(this.charge, this.clock, this.o.charge, this.colors);
    }
    if (this.blastClock !== null) {
      this.updateBlast(deltaMS);
    }
  }

  /**
   * Everything the blast throws off, on one clock and each on its own duration:
   * flash, shreds, spikes, rings, debris, glitter. They deliberately outlast
   * the phase that started them — a blast that stops dead the moment the next
   * phase begins is what made this read as two animations glued together.
   */
  updateBlast(deltaMS) {
    const burst = this.o.burst;
    this.blastClock += deltaMS;
    const elapsed = this.blastClock;

    this.flash.play(elapsed / burst.flashMs);
    // Only the blast whites the stage out. The landing is the opposite moment
    // — everything closing on the card — and a flash over the artwork there
    // reads as a second explosion rather than as an arrival
    this.screenFlash.play(
      elapsed,
      burst.screenFlashMs,
      burst.screenFlashAlpha,
      this.colors,
    );
    if (elapsed <= burst.shardMs) {
      this.shards.play(clamp(elapsed / burst.shardMs, 0, 1), burst, this.colors);
    } else if (this.shards.node.visible) {
      this.shards.hide();
    }
    this.effects.play(elapsed, burst, this.colors);

    // Nothing of it is left to draw
    const spent = Math.max(
      burst.flashMs,
      burst.shardMs,
      burst.spikeMs,
      burst.ringMs * (1 + burst.ringStagger * burst.rings),
      burst.debrisMs,
      burst.glitterMs,
    );
    if (elapsed > spent) {
      this.effects.clear();
      this.blastClock = null;
    }
  }

  updateIntro(deltaMS) {
    if (this.intro >= 1) {
      return;
    }
    this.intro = clamp(this.intro + deltaMS / this.o.motion.introMs, 0, 1);
    this.root.alpha = this.intro;
  }

  /** A finger held down is the only thing that builds pressure. */
  updateCharge(deltaMS) {
    if (this.locked || !this.tracking) {
      return;
    }
    this.charge = clamp(this.charge + deltaMS / this.o.charge.holdMs, 0, 1);
    this.reportCharge();
    if (this.charge >= 1) {
      this.commit();
    }
  }

  reportCharge() {
    if (this.charge - this.lastTick < this.o.charge.tickStep) {
      return;
    }
    this.lastTick = this.charge;
    this.emit(MESSAGES.TICK, {progress: this.charge});
  }

  /* ── options and layout ── */

  /**
   * Applies new options to a live scene. Numbers and colours land immediately;
   * anything baked into a texture, the shred grid or the pack rect waits for
   * the next `reset()`, because rebuilding mid-burst would replace the shreds
   * in flight with a fresh, motionless grid.
   */
  setOptions(next) {
    const before = this.o;
    this.o = next;
    this.colors = sceneColors(next.theme);
    this.card.setOptions(next, this.colors);
    this.pedestal.setOptions(next);

    const baked =
      JSON.stringify(before.theme) !== JSON.stringify(next.theme) ||
      JSON.stringify(before.layout) !== JSON.stringify(next.layout) ||
      before.burst.cols !== next.burst.cols ||
      before.burst.rows !== next.burst.rows ||
      before.burst.flashScale !== next.burst.flashScale ||
      before.burst.rings !== next.burst.rings ||
      before.burst.ringThickness !== next.burst.ringThickness ||
      before.burst.ringRagged !== next.burst.ringRagged ||
      before.burst.flareSpread !== next.burst.flareSpread ||
      before.burst.shapeJitter !== next.burst.shapeJitter ||
      before.burst.shapeSegments !== next.burst.shapeSegments ||
      before.burst.shapeRagged !== next.burst.shapeRagged ||
      before.burst.assembleCols !== next.burst.assembleCols ||
      before.burst.assembleRows !== next.burst.assembleRows ||
      before.burst.assembleSpread !== next.burst.assembleSpread;

    if (!baked) {
      return;
    }
    if (this.anim || this.charge > 0) {
      this.pendingRebuild = true;
      return;
    }
    this.rebuild();
  }

  /**
   * The stage changed size. A ceremony in flight keeps the pack it started
   * with — restarting the burst halfway through it would read as a glitch —
   * and the new geometry rides on the next `reset()`.
   */
  resize() {
    if (this.anim || this.charge > 0) {
      this.pendingRebuild = true;
      return;
    }
    this.rebuild();
  }

  rebuild() {
    this.pendingRebuild = false;
    this.rect = computePackRect(
      this.app.screen.width,
      this.app.screen.height,
      this.texture.width / this.texture.height,
      this.o.layout.pack,
    );

    this.pack.layout(this.rect);
    this.shards.build(this.rect, this.o.burst);
    this.shards.reset();
    this.flash.layout(this.rect, this.o.burst);
    this.effects.setShape(this.o.burst);
    this.effects.layout(this.rect);
    this.screenFlash.layout(this.app.screen);
    if (this.card.built) {
      this.card.destroy();
      this.card.build(this.rect);
      this.card.rewind(this.rect);
    this.pedestal.rewind();
      this.cardRect = this.card.bounds();
      this.buildAssembly();
    }

    // Whatever the host hangs off the pack — a hint, a slot — moved with it
    this.emit(MESSAGES.LAYOUT, {rect: this.rect});
  }

  reset() {
    if (this.pendingRebuild) {
      this.rebuild();
    }
    this.anim = null;
    this.charge = 0;
    this.lastTick = 0;
    this.locked = false;
    this.blasted = false;
    this.tracking = false;
    this.ignoring = false;
    this.artWaitStart = 0;
    this.handed = false;
    this.sheenAt = null;

    this.blastClock = null;
    this.pack.reset();
    this.shards.reset();
    this.flash.reset();
    this.effects.clear();
    this.assembly.reset();
    this.screenFlash.clear();
    this.kick = 0;
    this.root.position.set(0, 0);
    this.card.rewind(this.rect);
    this.pedestal.rewind();
  }

  /**
   * Only the scene graph — the renderer belongs to the host, which tears it
   * down itself. Keeps the variant safe to swap out without dropping the app.
   */
  destroy() {
    this.root.destroy({children: true});
  }
}
