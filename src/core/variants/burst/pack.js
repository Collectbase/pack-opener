/**
 * The pack while it is being charged: the artwork, the heat rising through it,
 * the halo around its silhouette, the bloom swelling behind it and the sparks
 * pulled in from outside. It owns those nodes and every transform applied to
 * them — the scene only says how far the charge has come.
 *
 * Everything is driven off one number, `charge` in 0..1, so the visuals cannot
 * drift out of step with the gesture that produced them.
 */
import {Container, Graphics, Sprite} from 'pixi.js';
import {jitterAt, outlinePath, pointAt} from '../shared/geometry';
import {makeBloomTexture, makeHaloTexture} from '../shared/textures';

/** One full turn of the spark stream, so they arrive in a steady flow. */
const SPARK_LOOP_MS = 900;

/** How far the silhouette glow bleeds past the pack, in css px. */
const HALO_SPREAD = 46;

/** Corner radius the progress arc rounds the pack with, and its resolution. */
const ARC_RADIUS = 18;
const ARC_STEPS = 96;

export class ChargingPack {
  constructor(root, texture, rect, theme) {
    this.theme = theme;
    this.root = root;

    // Behind the pack: the pressure has to read as coming from inside it
    this.bloom = new Sprite(makeBloomTexture(512, theme.bloom));
    this.bloom.anchor.set(0.5);
    this.bloom.blendMode = 'add';
    this.bloom.alpha = 0;
    root.addChild(this.bloom);

    // Glow hugging the silhouette. A stroked outline was the first attempt and
    // it read as a selection border around a list item, not as a pack about to
    // give — the light has to bleed outwards, not sit on the edge.
    this.halo = null;

    // The shudder and the squeeze move the artwork and the heat together, or
    // the two are a frame apart and the pack looks doubled
    this.node = new Container();
    this.sprite = new Sprite(texture);
    // The same artwork added on top of itself: the pack heats up from inside
    // instead of being outlined from outside
    this.heat = new Sprite(texture);
    this.heat.blendMode = 'add';
    this.heat.tint = 0xffffff;
    this.heat.alpha = 0;
    this.node.addChild(this.sprite, this.heat);

    // How far the charge has come, drawn around the pack. Without it a held
    // finger is a wait with no end in sight: the shudder says something is
    // happening, only the arc says how much longer.
    this.arc = new Graphics();
    this.node.addChild(this.arc);

    this.sparks = new Graphics();
    this.sparks.blendMode = 'add';

    root.addChild(this.node, this.sparks);
    this.layout(rect);
  }

  /** Called again whenever the pack rect changes — a resize or a retune. */
  layout(rect) {
    this.rect = rect;
    this.center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    for (const part of [this.sprite, this.heat]) {
      part.position.set(rect.left, rect.top);
      part.width = rect.width;
      part.height = rect.height;
    }

    this.path = outlinePath(rect.width, rect.height, ARC_RADIUS, 8);

    // Baked to the pack's size, so it is redrawn whenever that changes
    this.halo?.destroy();
    this.halo = new Sprite(
      makeHaloTexture(rect.width, rect.height, this.theme.glow, HALO_SPREAD, 18),
    );
    this.halo.anchor.set(0.5);
    this.halo.position.set(this.center.x, this.center.y);
    this.halo.width = rect.width + HALO_SPREAD * 2;
    this.halo.height = rect.height + HALO_SPREAD * 2;
    this.halo.blendMode = 'add';
    this.halo.alpha = 0;
    // Under the artwork: a halo over it washes the pack out
    this.root.addChildAt(this.halo, this.root.getChildIndex(this.node));

    // Scaling and shaking both happen about the middle of the pack
    this.node.pivot.set(this.center.x, this.center.y);
    this.node.position.set(this.center.x, this.center.y);

    this.bloom.position.set(this.center.x, this.center.y);
    this.bloom.width = rect.width * 2.1;
    this.bloom.height = rect.height * 1.5;
  }

  /**
   * `charge` is the pressure, `clock` the scene's running time. An untouched
   * pack breathes; a charged one shakes, squeezes and glows from the inside.
   */
  apply(charge, clock, options, colors) {
    const {rect, center} = this;
    // Squared, so the build reads as pressure rising rather than a linear slider
    const eased = charge * charge;

    // The breath fades out as the charge takes over: two scales fighting over
    // the same sprite came out as a stutter right where the tension starts
    const breath =
      Math.sin((clock / options.breatheMs) * Math.PI * 2) *
      options.breathe *
      (1 - charge);
    const squeeze = options.squeeze * eased;
    this.node.scale.set(1 + breath - squeeze, 1 + breath + squeeze * 0.6);

    // Two incommensurable frequencies, or the shudder reads as a tidy wobble
    const wobbleX = Math.sin(clock * options.shakeHz * 0.001 * Math.PI * 2);
    const wobbleY = Math.sin(clock * options.shakeHz * 0.0017 * Math.PI * 2);
    const amp = rect.height * options.shake * eased;
    this.node.position.set(center.x + wobbleX * amp, center.y + wobbleY * amp);
    this.node.rotation = wobbleY * eased * 0.012;

    // Each light on its own curve. The first attempt put all three on the
    // cube of the charge and the pack sat there looking untouched for most of
    // the hold — the light has to be visible early and still have somewhere to
    // go at the end.
    this.heat.tint = colors.glow;
    this.heat.alpha = options.heatAlpha * Math.pow(charge, 1.6);
    this.halo.alpha = options.haloAlpha * Math.pow(charge, 1.3);
    this.bloom.alpha = options.bloomAlpha * eased;

    this.drawArc(charge, options, colors);
    this.drawSparks(eased, clock, options, colors);
  }

  /**
   * The charge, drawn as a line closing around the pack. It starts at the top
   * middle and runs both ways at once, so the two ends meet at the bottom
   * exactly when the pack goes off — a single head running one lap read as a
   * loading spinner instead of something filling up.
   */
  drawArc(charge, options, colors) {
    const {rect, path} = this;
    this.arc.clear();
    if (charge <= 0.01) {
      return;
    }

    const half = path.total / 2;
    const reach = half * charge;
    const left = rect.left;
    const top = rect.top;

    for (const side of [1, -1]) {
      for (let i = 0; i < ARC_STEPS; i++) {
        const from = (reach * i) / ARC_STEPS;
        const to = (reach * (i + 1)) / ARC_STEPS;
        const p0 = pointAt(path, side * from);
        const p1 = pointAt(path, side * to);
        this.arc
          .moveTo(left + p0.x, top + p0.y)
          .lineTo(left + p1.x, top + p1.y)
          .stroke({
            width: options.arcWidth,
            color: colors.glow,
            alpha: options.arcAlpha,
            cap: 'round',
          });
      }
    }
  }

  /**
   * Sparks falling inwards. Each runs its own loop, offset by its index, so the
   * stream never pulses as one — and they travel on an ellipse around the pack
   * rather than a circle, or the ones above and below arrive visibly early.
   */
  drawSparks(strength, clock, options, colors) {
    const {rect, center} = this;
    this.sparks.clear();
    if (strength <= 0.02) {
      return;
    }

    for (let i = 0; i < options.sparks; i++) {
      const angle = (i / options.sparks) * Math.PI * 2 + jitterAt(i, 1.3);
      const phase = (clock / SPARK_LOOP_MS + i / options.sparks) % 1;
      // 1 at the pack edge, further out the younger the spark is
      const reach = 1 + options.sparkReach * (1 - phase);
      const x = center.x + Math.cos(angle) * (rect.width / 2) * reach;
      const y = center.y + Math.sin(angle) * (rect.height / 2) * reach;

      this.sparks
        .circle(x, y, options.sparkSize * (0.5 + 0.5 * phase))
        .fill({color: colors.spark, alpha: phase * strength});
    }
  }

  /** The wrapper is gone — the shreds carry the artwork from here on. */
  hide() {
    this.node.visible = false;
    this.arc.clear();
    this.sparks.clear();
    this.heat.alpha = 0;
    this.halo.alpha = 0;
    this.bloom.alpha = 0;
  }

  /** Whole and unlit again, for a replay. */
  reset() {
    this.node.visible = true;
    this.node.scale.set(1);
    this.node.rotation = 0;
    this.node.position.set(this.center.x, this.center.y);
    this.arc.clear();
    this.sparks.clear();
    this.heat.alpha = 0;
    this.halo.alpha = 0;
    this.bloom.alpha = 0;
  }
}
