/**
 * How the card arrives in the `burst` mechanic: not slid out of a wrapper and
 * turned over, but assembled. The wrapper was shredded a moment ago, so the
 * card answers it — a cloud of dust gathers, resolves into pieces of the
 * artwork, and they fly into place until the card is whole.
 *
 * The landing itself is not drawn here: it is the same front and flare the
 * blast uses, lit behind the card by the scene.
 */
import {Container, Graphics, Rectangle, Sprite, Texture} from 'pixi.js';
import {mixNumbers} from '../../runtime/color';
import {clamp, easeOut, jitterAt} from '../shared/geometry';
import {cutShardAtlas} from '../shared/shardAtlas';
import {makeBloomTexture} from '../shared/textures';

/** How fast the waiting cloud turns, in radians per second. */
const SWARM_SPIN = 0.6;

export class CardAssembly {
  constructor(root, theme) {
    this.node = new Container();
    this.node.visible = false;

    // Behind the cloud: without it the dust reads as noise on the backdrop
    // rather than as something forming
    this.bloom = new Sprite(makeBloomTexture(512, theme.bloom));
    this.bloom.anchor.set(0.5);
    this.bloom.blendMode = 'add';
    this.bloom.alpha = 0;

    // The stand-in cloud, drawn while the artwork is still downloading
    this.dust = new Graphics();
    this.dust.blendMode = 'add';

    this.pieces = [];
    this.node.addChild(this.bloom, this.dust);
    root.addChild(this.node);
  }

  /**
   * Where the pieces will end up, and where they start from. Called once the
   * card rect is known — the pieces are cut from the artwork, so this needs the
   * texture too; without one only the dust cloud can be drawn.
   */
  build(rect, texture, options) {
    this.rect = rect;
    this.center = {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
    // Pieces are placed in scene coordinates; pivoting the container on the
    // card's middle lets the hand-over scale them with the card underneath
    this.node.pivot.set(this.center.x, this.center.y);
    this.node.position.set(this.center.x, this.center.y);
    this.bloom.position.set(this.center.x, this.center.y);
    this.bloom.width = rect.width * 2.4;
    this.bloom.height = rect.height * 1.8;

    for (const piece of this.pieces) {
      piece.sprite.destroy();
    }
    this.pieces = [];
    if (!texture) {
      return;
    }

    const {assembleCols: cols, assembleRows: rows} = options;
    const base = texture.frame;
    const source = texture.source;
    const tileW = rect.width / cols;
    const tileH = rect.height / rows;
    // The wrapper came apart into ragged shards a moment ago; the card would
    // look cut from graph paper if it gathered itself out of squares. The
    // pieces interlock, so what lands is the artwork and not a mosaic of it
    const atlas = cutShardAtlas(texture, {...options, cols, rows});

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const frame = atlas
          ? atlas.frames[index]
          : new Rectangle(
              base.x + (base.width / cols) * c,
              base.y + (base.height / rows) * r,
              base.width / cols,
              base.height / rows,
            );
        const sprite = new Sprite(
          new Texture({source: atlas ? atlas.source : source, frame}),
        );
        sprite.anchor.set(0.5);
        // Cut pieces carry a margin around their tile and have to be drawn
        // with it; square ones need a hair over the tile instead, or the grid
        // shows as hairlines once they have landed
        sprite.width = atlas ? tileW * (1 + atlas.pad * 2) : tileW + 1;
        sprite.height = atlas ? tileH * (1 + atlas.pad * 2) : tileH + 1;
        // `width` is a scale underneath, so every later scale multiplies this
        // one instead of replacing it
        const baseScale = {x: sprite.scale.x, y: sprite.scale.y};

        const toX = rect.left + tileW * (c + 0.5);
        const toY = rect.top + tileH * (r + 0.5);
        // Out from where the piece belongs, so the cloud has the card's shape
        // in it from the start instead of collapsing out of a circle
        const angle = jitterAt(index, 0.4) * Math.PI;
        const reach =
          rect.height * options.assembleSpread * (0.55 + Math.abs(jitterAt(index, 3.1)) * 0.6);

        // Pieces from the middle land first: the card grows outwards instead of
        // arriving as one flat sheet
        const distance = Math.hypot(toX - this.center.x, toY - this.center.y);
        const reference = Math.hypot(rect.width, rect.height) / 2;

        this.pieces.push({
          sprite,
          toX,
          toY,
          fromX: toX + Math.cos(angle) * reach,
          fromY: toY + Math.sin(angle) * reach * 0.7,
          spin: jitterAt(index, 1.7) * options.assembleSpin,
          delay: (distance / reference) * options.assembleStagger,
          scaleFrom: options.assembleScaleFrom,
          baseScale,
        });
        this.node.addChild(sprite);
      }
    }
    this.park();
  }

  get built() {
    return this.pieces.length > 0;
  }

  /** Pieces back at their launch points, invisible. */
  park() {
    for (const piece of this.pieces) {
      piece.sprite.position.set(piece.fromX, piece.fromY);
      piece.sprite.rotation = piece.spin;
      this.scalePiece(piece, piece.scaleFrom);
      piece.sprite.alpha = 0;
    }
  }

  scalePiece(piece, factor) {
    piece.sprite.scale.set(
      piece.baseScale.x * factor,
      piece.baseScale.y * factor,
    );
  }

  /**
   * The waiting cloud: motes turning slowly where the card will be. This is
   * what the artwork's download hides behind, and it is also the reason the
   * assembly reads as inevitable — the dust is already card-shaped.
   */
  swarm(t, clock, options, colors) {
    this.node.visible = true;
    const {rect, center} = this;
    const presence = Math.min(1, t * 3);
    this.bloom.alpha = options.dustBloomAlpha * presence;

    this.dust.clear();
    const turn = (clock / 1000) * SWARM_SPIN;
    for (let i = 0; i < options.dustMotes; i++) {
      const angle = (i / options.dustMotes) * Math.PI * 2 + turn + jitterAt(i, 0.9);
      const radius = 0.35 + 0.45 * Math.abs(jitterAt(i, 2.3));
      const x = center.x + Math.cos(angle) * rect.width * radius;
      const y = center.y + Math.sin(angle) * rect.height * radius;
      const size = options.dustSize * (0.6 + 0.4 * Math.abs(jitterAt(i, 4.7)));
      this.dust
        .circle(x, y, size)
        .fill({color: colors.spark, alpha: presence * options.dustAlpha});
    }
  }

  /**
   * The assembly itself. `t` runs 0..1 over `burst.assembleMs`; each piece has
   * its own slice of that, so the card fills in rather than snapping together.
   */
  play(t, options, colors) {
    this.node.visible = true;

    // The dust hands over to the pieces rather than cutting out
    const fade = 1 - clamp(t / 0.35, 0, 1);
    this.dust.alpha = fade;
    this.bloom.alpha = options.dustBloomAlpha * (0.4 + 0.6 * t);

    for (const piece of this.pieces) {
      const span = 1 - piece.delay;
      const local = clamp((t - piece.delay) / (span || 1), 0, 1);
      const eased = easeOut(local);

      piece.sprite.x = piece.fromX + (piece.toX - piece.fromX) * eased;
      piece.sprite.y = piece.fromY + (piece.toY - piece.fromY) * eased;
      piece.sprite.rotation = piece.spin * (1 - eased);
      this.scalePiece(piece, piece.scaleFrom + (1 - piece.scaleFrom) * eased);
      // Up quickly: a piece that spends its first frames near invisible makes
      // the assembly look as if it starts late
      piece.sprite.alpha = Math.min(1, local * 2.6);
      // Tinted in flight and plain once landed, so what is flying reads as
      // light in the rarity colour and what has arrived reads as artwork. The
      // colour drains over the last of the approach — switching it on the
      // final frame is a flicker the eye catches every time
      piece.sprite.tint = mixNumbers(
        colors.glow,
        0xffffff,
        clamp((local - options.tintFrom) / (1 - options.tintFrom), 0, 1),
      );
    }
  }

  /**
   * The hand-over: the card is already up underneath, so the pieces dissolve
   * off it rather than being swapped out, and they take the same push the card
   * is given so nothing doubles.
   */
  settle(alpha, scale) {
    this.node.alpha = alpha;
    this.node.scale.set(scale);
  }

  /** The whole card has taken over — nothing here should still be visible. */
  hide() {
    this.node.visible = false;
    this.node.alpha = 1;
    this.node.scale.set(1);
    this.dust.clear();
    this.bloom.alpha = 0;
  }

  reset() {
    this.node.visible = false;
    this.node.alpha = 1;
    this.node.scale.set(1);
    this.dust.clear();
    this.dust.alpha = 1;
    this.bloom.alpha = 0;
    if (this.rect) {
      this.park();
    }
  }
}
