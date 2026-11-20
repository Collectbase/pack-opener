/**
 * The cards the climb's items turn into: each artwork cut to a rounded card
 * at the size it is shown, and the light round a card's shape — baked white
 * once per card size and shared, as the light round the pack is. A batch's
 * artwork and all that is baked from it live here, and go together.
 */
import {Texture} from 'pixi.js';
import {releaseTexture} from '../../runtime/ownTexture';
import {makeCardBackTexture, makeHaloTexture, roundRectPath} from '../shared/textures';

/** A face baked ahead still fits when its size is this close to the card's, in css px. */
const FIT = 0.5;
/**
 * What a card is printed on round its artwork: light, as the photo of a
 * graded card usually is, so a slab shot on white fills its card edge to edge.
 */
const PAPER = '#eceef1';

/** A card of `aspect` as large as a `size` box holds: what is left of the box goes round it. */
export function cardSize(size, aspect) {
  const byHeight = aspect <= size.width / size.height;
  const height = byHeight ? size.height : size.width / aspect;
  return {width: byHeight ? height * aspect : size.width, height};
}

/**
 * The artwork whole, centred on a `width` × `height` card (css px) of light
 * paper with corners of `radius`, at `resolution` pixels per css px — never
 * more than the artwork has. Every card of a batch has the one shape,
 * whatever the photo's. A copy the scene owns, so the host's texture is never
 * touched. Null when its pixels cannot be drawn.
 */
export function bakeCard(texture, width, height, radius, resolution) {
  const source = texture?.source?.resource;
  const sw = source?.width;
  const sh = source?.height;
  if (!sw || !sh || !(width > 0) || !(height > 0)) return null;
  try {
    const fit = Math.min(width / sw, height / sh);
    const k = Math.max(1, Math.min(resolution, 1 / fit));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width * k));
    canvas.height = Math.max(1, Math.ceil(height * k));
    const ctx = canvas.getContext('2d');
    ctx.scale(canvas.width / width, canvas.height / height);
    roundRectPath(ctx, 0, 0, width, height, radius);
    ctx.clip();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, (width - sw * fit) / 2, (height - sh * fit) / 2, sw * fit, sh * fit);
    return Texture.from(canvas);
  } catch {
    return null;
  }
}

/** The light round a card's outline, one per card size, shared by every card of it. */
export class CardGlows {
  constructor() {
    this.byKey = new Map();
  }

  /** For a `width` × `height` card with corners of `radius`, reaching `spread` past it. */
  get(width, height, spread, radius) {
    const key = `${Math.round(width)}x${Math.round(height)}/${spread}/${radius}`;
    let glow = this.byKey.get(key);
    if (!glow) {
      glow = {key, spread, texture: makeHaloTexture(width, height, '#ffffff', spread, radius)};
      this.byKey.set(key, glow);
    }
    return glow;
  }

  /** Lets go of every light but the ones in `keys`: no card is that size any more. */
  keep(keys) {
    for (const [key, glow] of this.byKey) {
      if (keys.has(key)) continue;
      glow.texture.destroy(true);
      this.byKey.delete(key);
    }
  }

  destroy() {
    this.keep(new Set());
  }
}

/**
 * One batch of cards as the items show them: the host's artwork, handed
 * over for good, and the faces baked from it — each card cut to its rounded
 * shape at the size it is shown, with the light round it. Faces are baked
 * ahead of their turns, one a frame, and sent to the GPU as they are baked,
 * so no turn waits on a canvas. Dropping the batch frees all of it.
 */
/** Artwork still on its way: its card waits to turn until it comes (`give`). */
export const PENDING = Symbol('pending');

export class CardFaces {
  constructor(renderer) {
    this.renderer = renderer;
    this.glows = new CardGlows();
    // A texture, null (none came) or PENDING per card, in grid order
    this.art = [];
    // `{texture, aspect, owned, width, height, glow}` per card, once baked
    this.faces = [];
    // Cards still to bake ahead
    this.waiting = [];
  }

  /** A new batch's artwork in place of the last — some of it, maybe, still on its way — every face to bake ahead. */
  take(art) {
    this.drop();
    this.art = art;
    this.waiting = art.map((texture, i) => i).filter(i => art[i] !== PENDING);
  }

  /** Card `i`'s artwork, come — or null, none will: its face is baked again from it, and ahead. */
  give(i, texture) {
    if (this.art[i] !== PENDING) return false;
    this.art[i] = texture ?? null;
    const kept = this.faces[i];
    if (kept?.owned) kept.texture.destroy(true);
    this.faces[i] = undefined;
    this.waiting.push(i);
    return true;
  }

  /** Card `i`'s artwork is in, or none will come: it may turn. */
  ready(i) {
    return this.art[i] !== PENDING;
  }

  /** These cards to bake ahead again: their items have another size. */
  rebake(indices) {
    this.waiting = indices;
  }

  /**
   * Card `i` for an item of `size`: its artwork whole on a rounded card of
   * the card's shape (`layout.card.aspect`), every card of the grid alike;
   * the artwork as it is when that cannot be done, or a blank card where the
   * artwork never came — with the light round it. Baked once per size.
   * `look` is what the card is drawn by: the `theme`, `layout.card` as
   * `card`, and the `spread` of the light.
   */
  faceOf(i, size, look) {
    const art = this.art[i] === PENDING ? null : this.art[i];
    const known = !!art && art.width > 0 && art.height > 0;
    const aspect = look.card.aspect;
    const {width, height} = cardSize(size, aspect);
    const kept = this.faces[i];
    if (kept && Math.abs(kept.width - width) < FIT && Math.abs(kept.height - height) < FIT) return kept;
    // Baked for a size the item no longer has, and shown by nobody yet
    if (kept?.owned) kept.texture.destroy(true);
    const radius = look.theme.cornerRadius;
    let texture = known ? bakeCard(art, width, height, radius, this.renderer.resolution) : null;
    if (!texture) texture = known ? art : makeCardBackTexture(width, height, look.theme);
    const glow = this.glows.get(width, height, look.spread, radius);
    this.upload(texture);
    this.upload(glow.texture);
    const face = {texture, aspect, owned: texture !== art, width, height, glow};
    this.faces[i] = face;
    return face;
  }

  /** The next face waiting, baked: `sizeOf(i)` is the size of card `i`'s item, or null for one already turned. */
  bakeNext(sizeOf, look) {
    while (this.waiting.length) {
      const i = this.waiting.shift();
      const size = sizeOf(i);
      if (!size) continue;
      this.faceOf(i, size, look);
      return;
    }
  }

  /** The light round a card of `size`. */
  light(size, spread, radius) {
    return this.glows.get(size.width, size.height, spread, radius);
  }

  /** The light baked ahead for card `i`, if any. */
  glowOf(i) {
    return this.faces[i]?.glow ?? null;
  }

  /** Lets go of every light but the ones in `keys`. */
  keep(keys) {
    this.glows.keep(keys);
  }

  /** On the GPU now, on a frame with room for it, rather than on the frame it first shows. */
  upload(texture) {
    try {
      this.renderer.texture.initSource(texture.source);
    } catch {
      // It goes up when it is first drawn instead
    }
  }

  /** Every face, every light and the artwork itself, freed: no item may still show any of it. */
  drop() {
    for (const face of this.faces) {
      if (face?.owned) face.texture.destroy(true);
    }
    this.faces = [];
    this.glows.keep(new Set());
    for (const texture of new Set(this.art)) {
      if (texture !== PENDING) releaseTexture(texture);
    }
    this.art = [];
    this.waiting = [];
  }
}
