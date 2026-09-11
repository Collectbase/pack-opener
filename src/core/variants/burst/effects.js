/**
 * What the blast throws off besides the wrapper itself: spikes of light out of
 * the centre, expanding rings, a cloud of debris with trails behind it, and
 * glitter that hangs in the air afterwards.
 *
 * All of it is drawn into three `Graphics` objects rather than one node per
 * particle: a few hundred short-lived motes as sprites would cost a few hundred
 * transforms every frame, and none of them is ever picked, measured or masked.
 *
 * Each layer runs on its own duration off one clock, so they overlap — the
 * spikes are gone before the debris has finished falling, and the glitter is
 * still drifting when the card starts to gather.
 */
import {Graphics} from 'pixi.js';
import {clamp, easeOut, jitterAt} from '../shared/geometry';

export class BlastEffects {
  constructor(root) {
    // Three layers, because they are cleared on different schedules
    this.spikes = new Graphics();
    this.rings = new Graphics();
    this.motes = new Graphics();
    for (const layer of [this.spikes, this.rings, this.motes]) {
      layer.blendMode = 'add';
      root.addChild(layer);
    }
  }

  layout(rect) {
    this.center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    this.size = Math.hypot(rect.width, rect.height) / 2;
    this.rect = rect;
  }

  /** `elapsed` is time since the pack went off, in ms. */
  play(elapsed, options, colors) {
    this.drawSpikes(elapsed, options, colors);
    this.drawRings(elapsed, options, colors);
    this.drawMotes(elapsed, options, colors);
  }

  /**
   * Spikes of light out of the middle. Uneven lengths on purpose — a rosette of
   * equal rays reads as a decoration, a ragged one reads as something bursting.
   */
  drawSpikes(elapsed, options, colors) {
    const t = elapsed / options.spikeMs;
    this.spikes.clear();
    if (t >= 1) {
      return;
    }

    const eased = easeOut(t);
    const fade = 1 - t * t;
    const {center} = this;

    for (let i = 0; i < options.spikes; i++) {
      const angle = (i / options.spikes) * Math.PI * 2 + jitterAt(i, 5.3) * 0.4;
      const length =
        this.size * options.spikeLength * (0.45 + Math.abs(jitterAt(i, 1.9)) * 0.85);
      const inner = this.size * 0.12 * eased;
      const outer = inner + length * eased;

      this.spikes
        .moveTo(center.x + Math.cos(angle) * inner, center.y + Math.sin(angle) * inner)
        .lineTo(center.x + Math.cos(angle) * outer, center.y + Math.sin(angle) * outer)
        .stroke({
          width: options.spikeWidth * (1 - eased * 0.75),
          color: i % 3 === 0 ? colors.beam : colors.glow,
          alpha: options.spikeAlpha * fade,
          cap: 'round',
        });
    }
  }

  /**
   * Expanding rings. More than one, started apart, because a single ring is a
   * circle growing and three are a shockwave.
   */
  drawRings(elapsed, options, colors) {
    this.rings.clear();
    let drawn = 0;

    for (let i = 0; i < options.rings; i++) {
      // Each wave starts a third of a wave-length after the one before it
      const delay = options.ringMs * options.ringStagger * i;
      const t = (elapsed - delay) / options.ringMs;
      if (t <= 0 || t >= 1) {
        continue;
      }
      drawn++;
      const eased = easeOut(t);
      const radius = this.size * (0.25 + options.ringReach * eased);
      this.rings.circle(this.center.x, this.center.y, radius).stroke({
        width: options.ringWidth * (1 - eased * 0.8),
        color: i % 2 === 0 ? colors.glow : colors.beam,
        alpha: options.ringAlpha * (1 - eased),
      });
    }

    if (!drawn) {
      this.rings.clear();
    }
  }

  /**
   * Debris and glitter, drawn together because they are the same kind of thing
   * at different speeds: the debris is thrown hard and falls, the glitter is
   * barely thrown at all and drifts down long after.
   *
   * Debris is drawn as short streaks rather than dots — a dot travelling
   * hundreds of pixels between frames reads as a stutter, a streak along its
   * own direction reads as speed.
   */
  drawMotes(elapsed, options, colors) {
    this.motes.clear();
    const {center} = this;

    const debrisT = elapsed / options.debrisMs;
    if (debrisT < 1) {
      const eased = easeOut(debrisT);
      const fade = 1 - clamp((debrisT - 0.35) / 0.65, 0, 1);

      for (let i = 0; i < options.debris; i++) {
        const angle = jitterAt(i, 0.31) * Math.PI;
        const speed = 0.35 + Math.abs(jitterAt(i, 2.13)) * 0.9;
        const reach = this.size * options.debrisSpread * speed;
        const drop =
          this.rect.height * options.debrisGravity * debrisT * debrisT * speed;

        const x = center.x + Math.cos(angle) * reach * eased;
        const y = center.y + Math.sin(angle) * reach * eased * 0.8 + drop;
        // Points back along the direction of travel
        const trail = options.debrisTrail * reach * (1 - debrisT) * 0.12;
        const size =
          options.debrisSize * (0.5 + Math.abs(jitterAt(i, 3.7)) * 0.9);

        this.motes
          .moveTo(x, y)
          .lineTo(
            x - Math.cos(angle) * trail,
            y - Math.sin(angle) * trail * 0.8,
          )
          .stroke({
            width: size,
            color: i % 4 === 0 ? colors.glow : colors.spark,
            alpha: options.debrisAlpha * fade,
            cap: 'round',
          });
      }
    }

    const glitterT = elapsed / options.glitterMs;
    if (glitterT >= 1) {
      return;
    }
    // In late, out slowly: the glitter is what keeps the screen alive through
    // the pause between the blast and the card gathering
    const presence = Math.min(1, glitterT * 6) * (1 - glitterT * glitterT);

    for (let i = 0; i < options.glitter; i++) {
      const angle = jitterAt(i, 4.21) * Math.PI;
      const spread = 0.2 + Math.abs(jitterAt(i, 1.13)) * 0.8;
      const sway = Math.sin(glitterT * Math.PI * 2 + i) * this.rect.width * 0.03;
      const x = center.x + Math.cos(angle) * this.size * spread + sway;
      const y =
        center.y +
        Math.sin(angle) * this.size * spread * 0.7 +
        this.rect.height * options.glitterFall * glitterT;
      const size =
        options.glitterSize * (0.4 + Math.abs(jitterAt(i, 6.7)) * 0.9);

      this.motes.circle(x, y, size).fill({
        color: i % 3 === 0 ? colors.glow : colors.spark,
        alpha: options.glitterAlpha * presence,
      });
    }
  }

  clear() {
    this.spikes.clear();
    this.rings.clear();
    this.motes.clear();
  }
}
