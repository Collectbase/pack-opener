/**
 * The climb's reveal from the stops on: what comes in what order, and when.
 * The items stop one by one in grid order; once every colour shows and a
 * beat has passed, the ordinary cards turn over in grid order; then the
 * hits, held back, turn together under a flash; then the combo is written
 * under the grid and counts the hits out, and once it has and every price
 * has counted the ceremony is over.
 * What came to rest or face up is told as it happens — in that order, each
 * once — and `finish()` tells the rest at once, for a ceremony skipped to
 * its end. The host may answer any of it by ending the ceremony, starting
 * another or resetting the scene; nothing is told after that.
 *
 * It keeps the clocks and the order; the scene owns the items and draws.
 */
import {MESSAGES} from '../../config/protocol';
import {STOP_TURNS} from './item';
import {stopGapMs} from './strobe';

/** The pause between the last item coming to rest and the first turning over, in turns. */
const BEAT_TURNS = 0.15;
/** How far a card comes up towards the eye as it turns over, as a share of its size; a hit, further. */
const TURN_LIFT = 0.08;
const HIT_LIFT = 0.16;
/** How long the hits tremble before they come round, in ms of the wall clock. */
const RATTLE_MS = 420;
/**
 * The longest the cards of a ceremony wait for their artwork, all told, in
 * ms: past that each turns over when due — blank where its artwork has not
 * come, its price and tier on it — and the artwork comes into it the moment
 * it loads.
 */
export const FACE_WAIT_MS = 1200;

const indices = n => Array.from({length: n}, (_, i) => i);

export class RevealSequence {
  /**
   * For the scene's items and cards as they are now — the grid no longer
   * changes once the items stop. The scene reads as it goes and is asked to
   * turn an item over (`turnItem`), show one as its card at once (`faceUp`),
   * start a price and tell where its card is (`announceRevealed`), strike
   * the flash, write the combo, `announce` a phase and `end` the ceremony.
   */
  constructor(scene) {
    this.scene = scene;
    this.n = scene.items.length;
    const hit = i => !!scene.cards[i]?.hit;
    this.plain = indices(this.n).filter(i => !hit(i));
    this.hits = indices(this.n).filter(hit);
    // The stops, the ordinary cards' turns and the hits' hold, as far as they have got
    this.clock = 0;
    this.stopped = 0;
    this.beat = 0;
    this.turns = null;
    this.hold = null;
    // What is left of the wait for the cards' artwork, in ms
    this.faceWait = FACE_WAIT_MS;
    // A combo still to be written, and how long it still waits for the blow under way as the finale began, in ms of the wall clock
    this.comboDue = false;
    this.comboWait = 0;
    // How far the host has been told: items at rest and cards up, each a count in
    // its own order, and whether the hits have come round
    this.told = {settled: 0, plain: 0, hits: 0, round: false};
  }

  /**
   * Still the ceremony on show, and not over. Checked after every word to
   * the host: answering it, the host may have ended this one (`skipToEnd`),
   * started another or reset the scene, and then what this one had left to
   * do or tell is dropped.
   */
  get live() {
    return this.scene.sequence === this && this.scene.phase !== 'done';
  }

  /**
   * The stops: one item after another in grid order, `stopStaggerMs` apart —
   * closer for a big grid, the cascade over in `STOP_SPREAD_MS` — each told
   * the colour it takes once still.
   */
  begin() {
    const scene = this.scene;
    const {stopStaggerMs, spinMs} = scene.o.climb;
    scene.phase = 'settle';
    this.beat = BEAT_TURNS * spinMs;
    scene.announce('settle', (this.n - 1) * stopGapMs(this.n, stopStaggerMs) + STOP_TURNS * spinMs);
    if (!this.live) return;
    this.updateStops(0);
  }

  /** The next steps, as far as `deltaMS` of the scene's time takes them. */
  update(deltaMS) {
    switch (this.scene.phase) {
      case 'settle':
        this.updateStops(deltaMS);
        break;
      case 'turn':
        this.updateTurns(deltaMS);
        break;
      case 'hits':
        this.updateHits(deltaMS);
        break;
      case 'finale':
        this.updateFinale(this.scene.wall);
        break;
      default:
        break;
    }
  }

  updateStops(deltaMS) {
    const {items, cards, o} = this.scene;
    this.clock += deltaMS;
    const gap = stopGapMs(this.n, o.climb.stopStaggerMs);
    while (this.stopped < this.n && this.clock >= this.stopped * gap) {
      const i = this.stopped++;
      items[i].settle(cards[i]?.color);
    }
    // Every colour shown, and a moment to see them before the first card turns
    if (this.told.settled < this.n) return;
    this.beat -= deltaMS;
    if (this.beat <= 0) this.beginTurns();
  }

  /** The ordinary cards turning over, in grid order, `flipStaggerMs` apart. */
  beginTurns() {
    const scene = this.scene;
    this.turns = {clock: 0, turned: 0};
    if (!this.plain.length) {
      this.beginHits();
      return;
    }
    scene.phase = 'turn';
    const {flipStaggerMs} = scene.o.climb;
    scene.announce('turn', (this.plain.length - 1) * flipStaggerMs + scene.turnMs);
    if (!this.live) return;
    this.updateTurns(0);
  }

  updateTurns(deltaMS) {
    const scene = this.scene;
    const turns = this.turns;
    turns.clock += deltaMS;
    const gap = scene.o.climb.flipStaggerMs;
    while (turns.turned < this.plain.length && turns.clock >= turns.turned * gap) {
      // A card whose artwork is still on its way holds the turns after it a while, which then keep their gaps
      if (!this.mayTurn([this.plain[turns.turned]], deltaMS)) {
        turns.clock = turns.turned * gap;
        break;
      }
      scene.turnItem(this.plain[turns.turned++], TURN_LIFT);
    }
    if (this.told.plain === this.plain.length) this.beginHits();
  }

  /** The hits: held back `hitHoldMs`, then turned together, under the flash. */
  beginHits() {
    const scene = this.scene;
    if (!this.hits.length) {
      this.beginFinale();
      return;
    }
    scene.phase = 'hits';
    const {hitHoldMs} = scene.o.climb;
    this.hold = {left: hitHoldMs, turned: false, rattled: false};
    scene.announce('hits', hitHoldMs + scene.turnMs);
  }

  updateHits(deltaMS) {
    const hold = this.hold;
    if (!hold.turned) {
      hold.left -= deltaMS;
      // The last of the hold they tremble: `RATTLE_MS` by the wall clock, however the ceremony is hurried
      if (!hold.rattled && hold.left <= RATTLE_MS * this.scene.pace) {
        hold.rattled = true;
        for (const i of this.hits) this.scene.items[i].rattle(RATTLE_MS);
        this.scene.emit(MESSAGES.CUE, {name: 'rattle', index: -1});
      }
      if (hold.left > 0) return;
      // Together or not at all: they wait a while for the last of their artwork
      if (!this.mayTurn(this.hits, deltaMS)) return;
      hold.turned = true;
      for (const i of this.hits) this.scene.turnItem(i, HIT_LIFT);
      return;
    }
    if (this.told.hits === this.hits.length) this.beginFinale();
  }

  /**
   * Cards `indices` may turn: their artwork is in, or the ceremony has
   * waited `FACE_WAIT_MS` for its artwork already — `deltaMS` more of it
   * spent now — and they turn blank.
   */
  mayTurn(indices, deltaMS) {
    if (this.faceWait <= 0 || indices.every(i => this.scene.faceReady(i))) return true;
    this.faceWait -= deltaMS;
    return false;
  }

  /** Every card up: the combo written under the grid, if there is one, while the last prices count. */
  beginFinale() {
    const scene = this.scene;
    scene.phase = 'finale';
    this.comboDue = !!scene.combo;
    this.comboWait = scene.kick.left;
    this.updateFinale(0);
  }

  /**
   * The combo is written once the blow the hits landed with is over: it
   * comes down with a thump of its own, and one given while the stage still
   * shakes would be lost in it. It waits for that blow only, by the clock —
   * a host shaking the stage on its own word meanwhile does not hold it back.
   */
  updateFinale(wallMS) {
    const scene = this.scene;
    if (!this.comboDue) return;
    this.comboWait -= wallMS;
    if (this.comboWait > 0) return;
    this.comboDue = false;
    const {rollUpMs} = scene.o.climb;
    scene.writeCombo(rollUpMs);
    // It lands, then counts its hits out
    scene.announce('combo', rollUpMs, scene.countMs);
  }

  /**
   * What came to rest or face up this frame, told in order: the stops in
   * grid order, the ordinary cards in grid order, then the hits — the moment
   * they come round, and each once it is still.
   */
  report() {
    const scene = this.scene;
    const {items} = scene;
    const told = this.told;
    while (told.settled < this.n && items[told.settled].settled) {
      this.tellSettled(told.settled++, false);
      if (!this.live) return;
    }
    while (this.turns && told.plain < this.turns.turned && items[this.plain[told.plain]].revealed) {
      scene.announceRevealed(this.plain[told.plain++], false);
      if (!this.live) return;
    }
    if (!this.hold?.turned) return;
    if (!told.round && this.hits.some(i => items[i].faceUp)) {
      told.round = true;
      scene.strikeFlash();
      scene.emit(MESSAGES.HITS_REVEALED);
      if (!this.live) return;
    }
    while (told.round && told.hits < this.hits.length && items[this.hits[told.hits]].revealed) {
      scene.announceRevealed(this.hits[told.hits++], false);
      if (!this.live) return;
    }
  }

  tellSettled(i, skipped) {
    const scene = this.scene;
    const payload = {index: i, colorIndex: scene.colorIndexOf(scene.cards[i]?.color)};
    if (skipped) payload.skipped = true;
    scene.emit(MESSAGES.CARD_SETTLED, payload);
  }

  /**
   * Every card up, every price counted, the combo in place and its hits
   * counted out: the prices gather into the total, and when the last has
   * left its card the ceremony is over — at once, when no price is on show.
   */
  conclude() {
    const scene = this.scene;
    if (scene.phase === 'gather') {
      if (!scene.gather) scene.end();
      return;
    }
    if (scene.phase !== 'finale' || this.comboDue) return;
    if (!scene.banner.finished || scene.beats || !scene.pricesCounted()) return;
    if (!scene.beginGather() && this.live) scene.end();
  }

  /**
   * The rest at once: every item at rest as its card, every price at its
   * figure, the combo in place — no flash. What the host was not told yet
   * is told now, in the order it would have come, marked `skipped`. A skip
   * asked for while this one tells the rest finishes it from there.
   */
  finish() {
    if (!this.live) return;
    const scene = this.scene;
    for (let i = 0; i < this.n; i++) scene.faceUp(i);
    this.stopped = this.n;
    this.turns = {clock: Infinity, turned: this.plain.length};
    this.hold = {left: 0, turned: true, rattled: true};
    this.comboDue = false;
    const told = this.told;
    while (told.settled < this.n) {
      this.tellSettled(told.settled++, true);
      if (!this.live) return;
    }
    while (told.plain < this.plain.length) {
      scene.announceRevealed(this.plain[told.plain++], true);
      if (!this.live) return;
    }
    if (this.hits.length && !told.round) {
      told.round = true;
      scene.emit(MESSAGES.HITS_REVEALED, {skipped: true});
      if (!this.live) return;
    }
    while (told.hits < this.hits.length) {
      scene.announceRevealed(this.hits[told.hits++], true);
      if (!this.live) return;
    }
    for (const label of scene.labels) label.complete();
    if (scene.combo) {
      if (!scene.banner.showing) scene.writeCombo(scene.o.climb.rollUpMs);
      scene.banner.complete();
    }
    scene.end();
  }
}
