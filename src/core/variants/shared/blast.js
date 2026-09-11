/**
 * The two pieces of light a blast is read by: the front that travels out of it
 * and the flare that goes off at its middle.
 *
 * Both are sprites over a texture baked once, not shapes redrawn every frame —
 * a stroked circle is a diagram, and three of them redrawn at sixty frames a
 * second is a diagram that costs something. Textures are white and tinted by
 * the caller, so the rarity colour never forces a rebuild.
 */
import {Container, Sprite, Texture} from 'pixi.js';
import {clamp, easeOut} from './geometry';
import {makeShockwaveTexture, makeStarburstTexture} from './textures';

const TEXTURE_SIZE = 512;

/**
 * The travelling front. Each wave is two sprites: a wide one in the rarity
 * colour and a thin white one riding it, which is what makes the edge read as
 * hot rather than as a coloured ring.
 */
export class ShockFront {
  constructor(root, count, shape) {
    this.node = new Container();
    root.addChild(this.node);
    this.waves = [];
    this.setShape(count, shape);
  }

  /**
   * The band and the ragged edge are baked into the texture, so changing them
   * — or the number of waves — is a rebuild. Done in place rather than by
   * replacing the node, or the front would end up drawn over the card.
   */
  setShape(count, shape) {
    this.dispose();
    this.glowTexture = makeShockwaveTexture(
      TEXTURE_SIZE,
      shape.thickness,
      shape.ragged,
    );
    this.coreTexture = makeShockwaveTexture(
      TEXTURE_SIZE,
      shape.thickness * 0.38,
      shape.ragged * 0.55,
    );

    for (let i = 0; i < count; i++) {
      const glow = new Sprite(this.glowTexture);
      const core = new Sprite(this.coreTexture);
      for (const sprite of [glow, core]) {
        sprite.anchor.set(0.5);
        sprite.blendMode = 'add';
        sprite.visible = false;
        this.node.addChild(sprite);
      }
      this.waves.push({glow, core});
    }
    if (this.center) {
      this.layout(this.center, this.size);
    }
  }

  dispose() {
    this.node.removeChildren().forEach(child => child.destroy());
    this.waves = [];
    this.glowTexture?.destroy(true);
    this.coreTexture?.destroy(true);
  }

  /** `size` is the radius the front is measured against. */
  layout(center, size) {
    this.center = center;
    this.size = size;
    for (const wave of this.waves) {
      wave.glow.position.set(center.x, center.y);
      wave.core.position.set(center.x, center.y);
    }
  }

  /**
   * `elapsed` is time since the blast, in ms. Waves start a stagger apart —
   * one circle growing is a circle growing, three are a shockwave.
   */
  play(elapsed, options, colors) {
    this.waves.forEach((wave, i) => {
      const delay = options.ringMs * options.ringStagger * i;
      const t = (elapsed - delay) / options.ringMs;
      if (t <= 0 || t >= 1) {
        wave.glow.visible = false;
        wave.core.visible = false;
        return;
      }

      const eased = easeOut(t);
      // Outward for a blast, inward for something gathering: the same front
      // run backwards closes on what it is lighting instead of leaving it
      const radius = options.ringInward
        ? this.size * (options.ringReach - (options.ringReach - 0.62) * eased)
        : this.size * (0.2 + options.ringReach * eased);
      // Flattened a little, so the front reads as travelling across a floor
      // rather than as a hoop drawn on the glass
      const squash = 1 - options.ringSquash;
      const scale = (radius * 2) / TEXTURE_SIZE;

      // A front leaving is brightest at the start and a front arriving is
      // brightest as it lands, so the curve turns over with the direction
      const presence = options.ringInward
        ? Math.pow(t, 0.7)
        : Math.pow(1 - t, 1.4);

      wave.glow.visible = true;
      wave.glow.scale.set(scale, scale * squash);
      wave.glow.tint = i % 2 === 0 ? colors.glow : colors.beam;
      wave.glow.alpha = options.ringAlpha * presence;

      // The hot edge is thinner, brighter and gone sooner than the colour
      // behind it
      wave.core.visible = true;
      wave.core.scale.set(scale * 1.01, scale * squash * 1.01);
      wave.core.tint = colors.rim;
      wave.core.alpha =
        options.ringCoreAlpha *
        (options.ringInward ? Math.pow(t, 1.6) : Math.pow(1 - t, 2.6));
    });
  }

  clear() {
    for (const wave of this.waves) {
      wave.glow.visible = false;
      wave.core.visible = false;
    }
  }
}

/**
 * The flare: a hot core with spindles of light out of it. Long across and short
 * down, turning slowly as it burns, because a symmetric star that holds still
 * reads as a decal.
 */
export class Starflare {
  constructor(root, spread) {
    this.sprite = new Sprite(makeStarburstTexture(TEXTURE_SIZE, spread));
    this.sprite.anchor.set(0.5);
    this.sprite.blendMode = 'add';
    this.sprite.visible = false;
    root.addChild(this.sprite);
  }

  /** The spindles are baked in, so their spread is a new texture. */
  setSpread(spread) {
    const before = this.sprite.texture;
    this.sprite.texture = makeStarburstTexture(TEXTURE_SIZE, spread);
    before.destroy(true);
  }

  layout(center, size) {
    this.center = center;
    this.size = size;
    this.sprite.position.set(center.x, center.y);
  }

  /** `elapsed` is time since the flare was lit, in ms. */
  play(elapsed, ms, options, colors) {
    const t = elapsed / ms;
    if (t <= 0 || t >= 1) {
      this.sprite.visible = false;
      return;
    }

    // Struck rather than raised: full within a tenth of its life, then a long
    // decay
    const rise = clamp(t / 0.08, 0, 1);
    const decay = Math.pow(1 - clamp((t - 0.08) / 0.92, 0, 1), 1.8);
    const reach = this.size * options.flareReach * (0.45 + 0.75 * easeOut(t));

    this.sprite.visible = true;
    this.sprite.alpha = options.flareAlpha * rise * decay;
    this.sprite.scale.set((reach * 2) / TEXTURE_SIZE);
    this.sprite.rotation = options.flareSpin * t;
    this.sprite.tint = colors.rim;
  }

  clear() {
    this.sprite.visible = false;
  }
}

/**
 * The whole stage going white for a moment. A blast the viewer watches from
 * outside is an animation; one that reaches the glass they are holding is an
 * event — and this is the cheapest way to reach it.
 */
export class ScreenFlash {
  constructor(root) {
    this.sprite = new Sprite(Texture.WHITE);
    this.sprite.anchor.set(0.5);
    this.sprite.blendMode = 'add';
    this.sprite.alpha = 0;
    this.sprite.visible = false;
    root.addChild(this.sprite);
  }

  layout(screen) {
    // Over-sized, so a shaking stage never shows an edge
    this.sprite.position.set(screen.width / 2, screen.height / 2);
    this.sprite.width = screen.width * 1.3;
    this.sprite.height = screen.height * 1.3;
  }

  /** `elapsed` is time since the flash was struck, in ms. */
  play(elapsed, ms, alpha, colors) {
    const t = elapsed / ms;
    if (t <= 0 || t >= 1) {
      this.clear();
      return;
    }
    // Instant on, quick off — held even a frame too long and it reads as a
    // white screen rather than as a hit
    this.sprite.alpha = alpha * Math.pow(1 - t, 2.2);
    // Full-stage and additive: not worth a single frame of fill once it is out
    this.sprite.visible = this.sprite.alpha > 0.01;
    this.sprite.tint = colors.rim;
  }

  clear() {
    this.sprite.alpha = 0;
    this.sprite.visible = false;
  }
}
