/**
 * What the cut throws off. While the finger is on the pack: a hot point under
 * the blade and sparks thrown off it as it goes. When the seal gives: a spray
 * of sparks off the whole length of the cut, and light pouring out of the
 * opened pack. Once the card is down: embers in its colour drifting up past
 * it. Nothing lies on the cut itself — that is the pack coming apart, the
 * wrapper's.
 *
 * The blade and the pour ride on the pack — the wrapper carries them, so they
 * float and jolt with it; sparks and embers fly free on the stage. Everything is additive and drawn into a few layers rather than a
 * sprite per spark: a few hundred sprites cost a few hundred transforms a
 * frame, a few hundred strokes in one graphic cost one draw.
 */
import {Graphics, Sprite} from 'pixi.js';
import {clamp, easeOut} from './geometry';
import {makeBloomTexture, makeSoftDotTexture} from '../shared/textures';

/** Seeded noise, so every replay throws the same sparks. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0x5eed;
/**
 * A spark is drawn as the stretch it covered over this long, in seconds: a dot
 * that jumps tens of pixels between frames reads as a stutter, a streak along
 * its own path reads as speed.
 */
const STREAK_S = 0.028;
/** Most sparks alive at once — past it, new ones wait for old ones to burn out. */
const MAX_SPARKS = 240;

export class SliceEffects {
  /** `pack` is the wrapper that carries the cut's light, `stage` the scene's root. */
  constructor(pack, stage) {
    this.pour = new Sprite(makeBloomTexture(256, '#ffffff'));
    this.pour.anchor.set(0.5);
    this.pour.blendMode = 'add';
    this.pour.visible = false;

    this.blade = new Sprite(makeSoftDotTexture(64));
    this.blade.anchor.set(0.5);
    this.blade.blendMode = 'add';
    this.blade.visible = false;

    pack.carry(this.pour);
    pack.carry(this.blade);

    this.sparkLayer = new Graphics();
    this.sparkLayer.blendMode = 'add';
    this.emberLayer = new Graphics();
    this.emberLayer.blendMode = 'add';
    stage.addChild(this.emberLayer, this.sparkLayer);

    this.reset();
  }

  reset() {
    this.sparks = [];
    this.embers = [];
    // ms since the embers set off, or -1 while there are none
    this.emberClock = -1;
    // What the last moves of the blade owe in sparks, carried to the next
    this.owed = 0;
    this.random = seeded(SEED);
    this.sparkLayer.clear();
    this.emberLayer.clear();
    this.blade.visible = false;
    this.pour.visible = false;
  }

  /** Whether anything is still in flight — the scene keeps its frame rate up for it. */
  get busy() {
    return this.sparks.length > 0 || this.emberClock >= 0;
  }

  spawn(x, y, vx, vy, life, size, color) {
    if (this.sparks.length >= MAX_SPARKS) {
      return;
    }
    this.sparks.push({x, y, vx, vy, life, size, color, age: 0});
  }

  /**
   * Sparks for the distance the blade just covered, thrown back along the cut
   * and out of it the way a grinder throws them. `y` is on the stage.
   */
  bladeSparks(x, y, travel, dir, fx, colors) {
    this.owed += travel * fx.bladeSparks;
    const count = Math.floor(this.owed);
    this.owed -= count;
    const back = dir > 0 ? Math.PI : 0;
    for (let i = 0; i < count; i++) {
      const angle = back + (this.random() - 0.5) * 2.4;
      const speed = fx.sparkSpeed * (0.35 + this.random() * 0.9);
      this.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - speed * 0.35,
        fx.sparkLifeMs * (0.5 + this.random() * 0.8),
        fx.sparkSize * (0.6 + this.random() * 0.8),
        this.random() < 0.35 ? colors.spark : colors.seam,
      );
    }
  }

  /**
   * The seal gives: sparks leave the whole length of the cut, most of them up
   * and out of the pack. `offsetY` puts the trail, which is in the pack's
   * space, on the stage.
   */
  burst(trail, fx, colors, offsetY = 0) {
    if (!trail.length) {
      return;
    }
    for (let i = 0; i < fx.burstSparks; i++) {
      const point = trail[Math.floor(this.random() * trail.length)];
      const up = this.random() < 0.72;
      const angle =
        (up ? -Math.PI / 2 : Math.PI / 2) +
        (this.random() - 0.5) * (up ? 2.3 : 1.5);
      const speed = fx.sparkSpeed * (0.55 + this.random() * 1.15);
      this.spawn(
        point.x,
        point.y + offsetY,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        fx.sparkLifeMs * (0.8 + this.random() * 0.9),
        fx.sparkSize * (0.7 + this.random()),
        this.random() < 0.45 ? colors.spark : colors.seam,
      );
    }
  }

  /** The point of light under the blade, or none. `at` is in the pack's space. */
  showBlade(at, fx, colors) {
    if (!at || fx.bladeGlow <= 0) {
      this.blade.visible = false;
      return;
    }
    this.blade.visible = true;
    this.blade.position.set(at.x, at.y);
    this.blade.width = fx.bladeGlow;
    this.blade.height = fx.bladeGlow;
    // White-hot, where the tear is being made
    this.blade.tint = colors.spark;
    this.blade.alpha = 0.9;
  }

  /**
   * Light pouring out of the opened pack, `level` 0..1, spread along the lip
   * at `y` — wide and low, the way light leaves a slot, not a beam.
   */
  pourAt(rect, y, level, fx, colors) {
    const sprite = this.pour;
    if (level <= 0.005 || fx.pourAlpha <= 0) {
      sprite.visible = false;
      return;
    }
    sprite.visible = true;
    sprite.position.set(rect.left + rect.width / 2, y);
    sprite.width = rect.width * 1.35;
    sprite.height = rect.height * (0.26 + 0.22 * level);
    sprite.tint = colors.seam;
    sprite.alpha = fx.pourAlpha * level;
  }

  /**
   * Embers rising past the card once it is down. `card` is its box on the
   * stage; they start round its lower half and drift up and out of sight.
   */
  startEmbers(card, fx) {
    this.emberClock = 0;
    this.embers = [];
    for (let i = 0; i < fx.embers; i++) {
      this.embers.push({
        x: card.left + card.width * (-0.12 + this.random() * 1.24),
        y: card.top + card.height * (0.3 + this.random() * 0.8),
        delay: this.random() * fx.emberMs * 0.45,
        life: fx.emberMs * (0.35 + this.random() * 0.45),
        rise: card.height * fx.emberRise * (0.4 + this.random() * 0.8),
        sway: (this.random() - 0.5) * card.width * 0.2,
        phase: this.random() * Math.PI * 2,
        size: fx.emberSize * (0.5 + this.random() * 0.9),
        white: this.random() < 0.3,
      });
    }
  }

  update(deltaMS, fx, colors) {
    this.updateSparks(deltaMS, fx);
    this.updateEmbers(deltaMS, fx, colors);
  }

  updateSparks(deltaMS, fx) {
    const g = this.sparkLayer;
    g.clear();
    const dt = deltaMS / 1000;
    const drag = Math.max(0, 1 - 1.4 * dt);
    let alive = 0;
    for (const s of this.sparks) {
      s.age += deltaMS;
      if (s.age >= s.life) {
        continue;
      }
      s.vx *= drag;
      s.vy = s.vy * drag + fx.sparkGravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const u = s.age / s.life;
      g.moveTo(s.x, s.y)
        .lineTo(s.x - s.vx * STREAK_S, s.y - s.vy * STREAK_S)
        .stroke({
          width: s.size * (1 - u * 0.5),
          color: s.color,
          alpha: Math.pow(1 - u, 1.3),
          cap: 'round',
        });
      this.sparks[alive++] = s;
    }
    this.sparks.length = alive;
  }

  updateEmbers(deltaMS, fx, colors) {
    const g = this.emberLayer;
    g.clear();
    if (this.emberClock < 0) {
      return;
    }
    this.emberClock += deltaMS;
    let left = 0;
    for (const e of this.embers) {
      const u = (this.emberClock - e.delay) / e.life;
      if (u >= 1) {
        continue;
      }
      left++;
      if (u <= 0) {
        continue;
      }
      // In quickly, out slowly: an ember catches, then cools on the way up
      const presence = Math.min(1, u * 5) * Math.pow(1 - u, 1.2);
      const x = e.x + e.sway * Math.sin(u * Math.PI * 2 + e.phase);
      const y = e.y - e.rise * easeOut(u);
      const color = e.white ? colors.spark : colors.glow;
      const alpha = clamp(fx.emberAlpha * presence, 0, 1);
      g.circle(x, y, e.size * 2.6).fill({color, alpha: alpha * 0.18});
      g.circle(x, y, e.size).fill({color, alpha});
    }
    if (!left) {
      this.emberClock = -1;
    }
  }
}
