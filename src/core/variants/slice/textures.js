/**
 * Canvas-drawn textures the scene needs but Pixi cannot express: the blank card
 * back, the radial bloom and the halo that hugs the card. Each is rasterised
 * once and handed over as a texture, so options baked in here only change on a
 * rebuild.
 */
import {Texture} from 'pixi.js';
import {withAlpha} from '../../runtime/color';

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.ceil(w * dpr));
  canvas.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return {canvas, ctx};
}

/** `ctx.roundRect` is missing on older WebViews. */
function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Blank slab the card shows while it spins. */
export function makeCardBackTexture(w, h, theme) {
  const {canvas, ctx} = makeCanvas(w, h);
  roundRectPath(ctx, 0, 0, w, h, theme.cornerRadius);
  ctx.clip();

  const back = theme.cardBack;
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, back.top);
  base.addColorStop(0.5, back.mid);
  base.addColorStop(1, back.bottom);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const sheen = ctx.createLinearGradient(0, h, w, 0);
  sheen.addColorStop(0, withAlpha(back.sheen, 0));
  sheen.addColorStop(0.5, back.sheen);
  sheen.addColorStop(1, withAlpha(back.sheen, 0));
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  return Texture.from(canvas);
}

/** Soft radial bloom — the card glows while it is still blank. */
export function makeBloomTexture(size, color) {
  const {canvas, ctx} = makeCanvas(size, size);
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, withAlpha(color, 0.95));
  gradient.addColorStop(0.42, withAlpha(color, 0.3));
  gradient.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

/** Halo hugging the card silhouette, in the rarity colour. */
export function makeHaloTexture(w, h, color, spread, radius) {
  const {canvas, ctx} = makeCanvas(w + spread * 2, h + spread * 2);
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    ctx.shadowBlur = spread * (0.45 + i * 0.35);
    roundRectPath(ctx, spread, spread, w, h, radius);
    ctx.fill();
  }
  return Texture.from(canvas);
}
