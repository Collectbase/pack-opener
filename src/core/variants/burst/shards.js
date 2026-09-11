/**
 * The wrapper coming apart: a flash that covers the moment it stops existing,
 * and the shards of foil thrown out of it.
 *
 * The shards are not tiles — they are cut from the pack artwork by
 * `cutShardAtlas`, each to its own ragged outline.
 *
 * One stage, not two. Breaking big pieces into smaller ones partway through
 * their flight read as the debris jumping, so the wrapper goes straight to
 * shards.
 */
import {Container, Sprite, Texture} from 'pixi.js';
import {clamp, jitterAt} from '../shared/geometry';
import {cutShardAtlas} from '../shared/shardAtlas';
import {makeBloomTexture} from '../shared/textures';

export class BurstShards {
  constructor(root, texture, rect, options) {
    this.texture = texture;
    this.node = new Container();
    this.node.visible = false;
    this.pieces = [];
    root.addChild(this.node);
    this.build(rect, options);
  }

  /**
   * Cuts the shards and works out where each one is thrown. Done once per
   * layout rather than per frame: the atlas costs a few hundred canvas clips,
   * and a burst is not the moment to be rasterising anything.
   */
  build(rect, options) {
    this.node.removeChildren().forEach(child => child.destroy());
    this.pieces = [];

    const atlas = cutShardAtlas(this.texture, options);
    if (!atlas) {
      return;
    }

    const {cols, rows} = options;
    const stepW = rect.width / cols;
    const stepH = rect.height / rows;
    // Each shard was cut with a margin around its cell, and it has to be drawn
    // with the same one or the mosaic no longer lines up
    const drawW = stepW * (1 + atlas.pad * 2);
    const drawH = stepH * (1 + atlas.pad * 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const sprite = new Sprite(
          new Texture({source: atlas.source, frame: atlas.frames[index]}),
        );
        sprite.anchor.set(0.5);
        sprite.width = drawW;
        sprite.height = drawH;
        // Every later scale multiplies this one instead of replacing it
        const baseScale = {x: sprite.scale.x, y: sprite.scale.y};

        const x0 = rect.left + stepW * (c + 0.5);
        const y0 = rect.top + stepH * (r + 0.5);
        // Away from the middle, so the pack opens outwards; shards near the
        // edge start further out and therefore fly further, which is what a
        // wrapper bursting actually looks like
        const nx = (c + 0.5) / cols - 0.5 + jitterAt(index, 0.7) * 0.22;
        const ny = (r + 0.5) / rows - 0.5 + jitterAt(index, 2.9) * 0.22;
        // No two shards at the same speed, or the grid is legible again
        const scatter = 1 + jitterAt(index, 3.3) * options.scatter;

        this.pieces.push({
          sprite,
          x0,
          y0,
          baseScale,
          // Travel over the whole phase, so `play` takes a plain 0..1
          vx: nx * options.spread * rect.width * scatter,
          vy:
            (ny * options.spread * rect.height - options.lift * rect.height) *
            scatter,
          gravity: options.gravity * rect.height,
          spin: jitterAt(index, 2.1) * options.spin,
          // Uneven, so they do not all wink out together — but measured
          // against the phase's own clock, not the shard's. A shard fading on
          // its own schedule is still half there when the blast ends, and
          // cutting it off at that point is what makes the burst look clipped
          fadeAt: clamp(
            options.fadeFrom * (1 + jitterAt(index, 5.1) * options.lifeScatter),
            0.1,
            0.92,
          ),
          // Same treatment for the burn: all of them flaring on the same
          // frame is a click the eye hears
          glowAt: clamp(
            options.glowFrom * (1 + jitterAt(index, 2.7) * options.lifeScatter),
            0.1,
            0.95,
          ),
          glowing: false,
        });
        this.node.addChild(sprite);
      }
    }
    this.reset();
  }

  /** `t` runs 0..1 over `burst.shardMs`. */
  play(t, options, colors) {
    this.node.visible = true;

    const local = clamp(t, 0, 1);

    for (const piece of this.pieces) {
      const fade = clamp((local - piece.fadeAt) / (1 - piece.fadeAt), 0, 1);

      piece.sprite.x = piece.x0 + piece.vx * local;
      piece.sprite.y =
        piece.y0 + piece.vy * local + 0.5 * piece.gravity * local * local;
      piece.sprite.rotation = piece.spin * local;
      // Eased out rather than linear, so the last of it thins away instead of
      // stopping
      piece.sprite.alpha = (1 - fade) * (1 - fade);
      // A sprite at zero alpha still costs a transform and a place in the
      // batch, and there are a hundred and fifty of them here
      piece.sprite.visible = piece.sprite.alpha > 0.01;

      // Burning out: past this point a shard stops being foil and becomes a
      // spark, which is the only cheap way to make this many of them glow
      const glowing = local >= piece.glowAt;
      if (glowing !== piece.glowing) {
        piece.glowing = glowing;
        piece.sprite.blendMode = glowing ? 'add' : 'normal';
        piece.sprite.tint = glowing ? colors.glow : 0xffffff;
      }
      if (glowing) {
        // Swelling as it burns, the way a spark flares before it dies
        const burn =
          1 + ((local - piece.glowAt) / (1 - piece.glowAt)) * options.glowSwell;
        piece.sprite.scale.set(
          piece.baseScale.x * burn,
          piece.baseScale.y * burn,
        );
      }
    }
  }

  /** The flight is over — stop handing the GPU a hundred invisible sprites. */
  hide() {
    this.node.visible = false;
  }

  /** Back inside the pack shape and out of sight, for a replay. */
  reset() {
    this.node.visible = false;
    for (const piece of this.pieces) {
      piece.sprite.position.set(piece.x0, piece.y0);
      piece.sprite.rotation = 0;
      piece.sprite.alpha = 1;
      piece.sprite.visible = true;
      piece.sprite.blendMode = 'normal';
      piece.sprite.tint = 0xffffff;
      piece.sprite.scale.set(piece.baseScale.x, piece.baseScale.y);
      piece.glowing = false;
    }
  }
}

/**
 * The flash. Its job is not to be pretty but to hide a cut: the wrapper is one
 * sprite in one frame and a cloud of shards in the next, and the eye must not
 * be given the chance to see the swap.
 */
export class BurstFlash {
  constructor(root, rect, theme, options) {
    this.sprite = new Sprite(makeBloomTexture(512, theme.bloom));
    this.sprite.anchor.set(0.5);
    this.sprite.blendMode = 'add';
    this.sprite.alpha = 0;
    root.addChild(this.sprite);
    this.layout(rect, options);
  }

  layout(rect, options) {
    this.sprite.position.set(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    this.sprite.width = rect.width * options.flashScale;
    this.sprite.height = rect.height * options.flashScale;
    // `width` is a scale underneath, and `play` scales on top of it
    this.base = {x: this.sprite.scale.x, y: this.sprite.scale.y};
  }

  /**
   * `t` runs 0..1 over `burst.flashMs`. The curve peaks early and falls off
   * slowly — a symmetric fade reads as a lamp being turned up rather than
   * something going off.
   */
  play(t) {
    this.sprite.alpha = Math.sin(Math.PI * Math.pow(clamp(t, 0, 1), 0.55));
    const grow = 0.6 + 0.5 * t;
    this.sprite.scale.set(this.base.x * grow, this.base.y * grow);
  }

  reset() {
    this.sprite.alpha = 0;
    this.sprite.scale.set(this.base.x, this.base.y);
  }
}
