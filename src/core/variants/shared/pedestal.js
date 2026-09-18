/**
 * The stand the revealed card is shown above. The card hangs over it rather
 * than resting on it — the gap is the design's, not a rounding error — and the
 * stand itself sits still: it belongs to the stage, not to the card's flight.
 *
 * Shared by every mechanic on purpose. How the wrapper comes apart is what
 * makes a mechanic; where the card ends up is the same everywhere, and so is
 * what it ends up over.
 */
import {Sprite, Texture} from 'pixi.js';

export class CardPedestal {
  /** `sceneRoot` is the variant's own container. */
  constructor(sceneRoot, options) {
    this.sceneRoot = sceneRoot;
    this.o = options;
    this.texture = null;
    this.node = null;
    this.progress = 0;
    this.revealing = false;
  }

  setOptions(options) {
    this.o = options;
  }

  get built() {
    return !!this.node;
  }

  setTexture(texture) {
    this.texture = texture;
    if (this.node && texture) {
      this.node.texture = texture;
      this.fit();
    }
  }

  /**
   * Placed under where the card comes to rest, not under where it starts:
   * `centreX` is the card's column, `cardBottom` the lower edge of the card in
   * its final position, `cardWidth` what the stand is measured against.
   */
  build(centreX, cardBottom, cardWidth) {
    this.centreX = centreX;
    this.cardBottom = cardBottom;
    this.cardWidth = cardWidth;

    if (!this.node) {
      this.node = new Sprite(this.texture || Texture.EMPTY);
      this.node.anchor.set(0.5, 0);
      this.node.alpha = 0;
      // Under the card, above the backdrop: the card is added at index 0 by
      // the time this runs, so the stand goes below it
      this.sceneRoot.addChildAt(this.node, 0);
    }

    this.fit();
  }

  fit() {
    if (!this.node) {
      return;
    }

    const {widthRatio, aspect, gapRatio} = this.o.layout.pedestal;
    const width = this.cardWidth * widthRatio;

    this.node.width = width;
    this.node.height = width * aspect;
    this.node.position.set(
      this.centreX,
      this.cardBottom + this.cardWidth * gapRatio,
    );
  }

  /**
   * Starts the stand's own arrival. Called once the card has landed: it comes
   * in behind the card and ahead of whatever the host hangs under it, so the
   * eye goes card → stand → price.
   */
  reveal() {
    this.revealing = true;
  }

  update(deltaMS) {
    if (!this.node || !this.revealing || this.progress >= 1) {
      return;
    }

    this.progress = Math.min(
      1,
      this.progress + deltaMS / this.o.motion.reveal.pedestalMs,
    );
    this.node.alpha = this.progress;
  }

  /** Where it ended up, so the host can lay its own UI out below it. */
  bounds() {
    if (!this.node) {
      return null;
    }

    const {width, height} = this.node;
    return {
      left: this.node.x - width / 2,
      right: this.node.x + width / 2,
      top: this.node.y,
      bottom: this.node.y + height,
      width,
      height,
    };
  }

  rewind() {
    this.revealing = false;
    this.progress = 0;
    if (this.node) {
      this.node.alpha = 0;
    }
  }

  destroy() {
    this.node?.destroy();
    this.node = null;
  }
}
