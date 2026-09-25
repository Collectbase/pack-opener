/**
 * Canvas-drawn textures a scene needs but Pixi cannot express: the card back,
 * the radial bloom, the halo that hugs the card, the light round the pack's own
 * outline and the small lights thrown about the stage. Each is rasterised once
 * and handed over as a texture, so options baked in here only change on a
 * rebuild. Shared by every mechanic — they all reveal the same card.
 */
import {Texture} from 'pixi.js';
import {alphaOf, withAlpha} from '../../runtime/color';

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.ceil(w * dpr));
  canvas.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return {canvas, ctx};
}

/** The whole image: what the pixels say when they cannot be read. */
export const WHOLE = {left: 0, top: 0, right: 1, bottom: 1};

/**
 * Where the pack itself is in its artwork, as fractions of the image: a
 * pack image carries transparent margins, and laid out by its edges the
 * pack comes out smaller than asked, while a reflection that starts at the
 * image's edge floats a margin's width below the pack, twice over. Read
 * once off the pixels, coarsely; the whole image when they cannot be read
 * (a tainted canvas).
 */
export function contentBoundsOf(texture) {
  try {
    const source = texture?.source?.resource;
    if (!source || !source.width) return WHOLE;
    const w = 128;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(source, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let left = w;
    let right = -1;
    let top = h;
    let bottom = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] <= 24) continue;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    if (right < 0) return WHOLE;
    return {left: left / w, top: top / h, right: (right + 1) / w, bottom: (bottom + 1) / h};
  } catch {
    return WHOLE;
  }
}

/** A colour worth drawing: `transparent` or zero alpha turns a layer off. */
const shows = color => alphaOf(color, 0) > 0;

/** Four- or more-pointed star, points out along the axes first. */
function starPath(ctx, cx, cy, outer, inner, points = 4) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outer : inner;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

/**
 * The beam as one piece: a streak that builds up towards its head, ends in a
 * rounded nose and fades across its width, for a `MeshRope` to lay along the
 * card's outline. Drawn white for the caller to tint. `width` is the streak's
 * thickness in css px; it is rasterised at 1× on purpose — the softness is
 * the point.
 */
export function makeCometTexture(width) {
  const length = 256;
  const canvas = document.createElement('canvas');
  canvas.width = length;
  canvas.height = Math.max(2, Math.ceil(width));
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  const data = image.data;
  const half = canvas.height / 2;
  const sigma = canvas.height / 4.5;
  for (let y = 0; y < canvas.height; y++) {
    const d = (y + 0.5 - half) / sigma;
    const across = Math.exp(-d * d * 0.5);
    for (let x = 0; x < length; x++) {
      const t = (x + 0.5) / length;
      const rise = t * t;
      const nose = t > 0.94 ? 1 - Math.pow((t - 0.94) / 0.06, 2) : 1;
      const alpha = Math.max(0, Math.min(1, rise * nose * across));
      const i = (y * length + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return Texture.from(canvas);
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

/**
 * The printed side of the back: fine cross-hatching the way a banknote is
 * engraved, a double frame and a star in the middle. Drawn only in the colours
 * the theme gives it — a back with no `line` or `emblem` colour stays a plain
 * slab.
 */
function drawBackPrint(ctx, w, h, radius, back) {
  if (!shows(back.line) && !shows(back.emblem)) {
    return;
  }
  if (shows(back.line)) {
    ctx.save();
    ctx.strokeStyle = back.line;
    ctx.lineWidth = 0.6;
    const step = Math.max(4, w / 30);
    ctx.beginPath();
    for (let d = -h; d < w + h; d += step) {
      ctx.moveTo(d, 0);
      ctx.lineTo(d + h, h);
      ctx.moveTo(d + h, 0);
      ctx.lineTo(d, h);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Darker towards the edges, so the middle reads as lit
  const vignette = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.7,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  if (!shows(back.emblem)) {
    return;
  }
  const emblem = alphaOf(back.emblem, 1);
  ctx.save();
  ctx.strokeStyle = back.emblem;
  for (const [inset, width, alpha] of [
    [0.055, 1.2, 0.5],
    [0.085, 0.7, 0.25],
  ]) {
    const d = w * inset;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    roundRectPath(ctx, d, d, w - d * 2, h - d * 2, Math.max(2, radius - d * 0.6));
    ctx.stroke();
  }

  const cx = w / 2;
  const cy = h / 2;
  // A diamond round the star, and a thin circle round both
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.27, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1.3;
  starPath(ctx, cx, cy, w * 0.21, w * 0.21 * 0.7, 4);
  ctx.stroke();

  const fill = ctx.createLinearGradient(0, cy - w * 0.16, 0, cy + w * 0.16);
  fill.addColorStop(0, withAlpha(back.emblem, emblem));
  fill.addColorStop(1, withAlpha(back.emblem, emblem * 0.45));
  ctx.globalAlpha = 1;
  ctx.fillStyle = fill;
  starPath(ctx, cx, cy, w * 0.16, w * 0.045, 4);
  ctx.fill();
  ctx.restore();
}

/** The card's back: the slab it shows until it turns over to its artwork. */
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

  drawBackPrint(ctx, w, h, theme.cornerRadius, back);

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

/**
 * The front of a blast, as a ring that is thick and soft rather than a stroked
 * circle — a one-pixel outline reads as a diagram, a front with a core and a
 * falloff reads as something arriving. Drawn white and tinted by the caller, so
 * one texture serves both the cold outer wave and the hot inner one.
 *
 * `thickness` is the share of the radius the front occupies, `ragged` how far
 * its outer edge wanders off the circle — a perfectly round shockwave is the
 * other half of why the old one looked like a diagram.
 */
export function makeShockwaveTexture(size, thickness, ragged) {
  const {canvas, ctx} = makeCanvas(size, size);
  const c = size / 2;
  const outer = c * 0.97;
  const inner = outer * (1 - Math.min(0.9, thickness));

  ctx.save();
  // The wandering outer edge is a clip, so the falloff underneath stays radial
  ctx.beginPath();
  const steps = 128;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const wobble =
      Math.sin(angle * 5 + 0.7) * 0.6 + Math.sin(angle * 11 + 2.3) * 0.4;
    const r = outer * (1 - ragged * (0.5 + 0.5 * wobble));
    const x = c + Math.cos(angle) * r;
    const y = c + Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.clip();

  // Empty inside: a band that keeps any opacity towards its middle fills the
  // stage with milk instead of passing over it
  const gradient = ctx.createRadialGradient(c, c, inner * 0.9, c, c, outer);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.06)');
  gradient.addColorStop(0.88, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.96, 'rgba(255,255,255,0.4)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  return Texture.from(canvas);
}

/**
 * The flare that goes off with the blast and again when the card lands: a hot
 * core with spindles of light out of it, long across and short down, the way a
 * lens answers a light it cannot hold. White, for the caller to tint.
 */
export function makeStarburstTexture(size, spread) {
  const {canvas, ctx} = makeCanvas(size, size);
  const c = size / 2;

  // Spindles first, so the core burns over where they meet
  const rays = [
    {angle: 0, length: 1, width: 0.05},
    {angle: Math.PI / 2, length: 0.62, width: 0.04},
    {angle: Math.PI / 4, length: 0.3, width: 0.02},
    {angle: -Math.PI / 4, length: 0.3, width: 0.02},
  ];

  for (const ray of rays) {
    for (const direction of [1, -1]) {
      const length = c * ray.length * spread * direction;
      const width = c * ray.width;
      const dx = Math.cos(ray.angle) * length;
      const dy = Math.sin(ray.angle) * length;
      const nx = -Math.sin(ray.angle) * width;
      const ny = Math.cos(ray.angle) * width;

      const gradient = ctx.createLinearGradient(c, c, c + dx, c + dy);
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
      gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;

      // A spindle rather than a triangle: widest just off the core, so the
      // light looks pinched at both ends
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + dx * 0.18 + nx, c + dy * 0.18 + ny);
      ctx.lineTo(c + dx, c + dy);
      ctx.lineTo(c + dx * 0.18 - nx, c + dy * 0.18 - ny);
      ctx.closePath();
      ctx.fill();
    }
  }

  const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.22);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  return Texture.from(canvas);
}

/**
 * The band of light that runs across a card the way a window runs across
 * glossy stock. Drawn along the sprite's width and soft at both ends, so what
 * crosses the artwork is a highlight rather than a bar.
 */
export function makeSheenTexture(w, h) {
  const {canvas, ctx} = makeCanvas(w, h);
  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.38, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.62, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
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

/**
 * Light round the pack's own outline rather than round its box: the
 * artwork's alpha thrown out as a white shadow, for the caller to tint. Only
 * the shadow lands on the canvas — the artwork is drawn off it — so none of
 * the pack's colours leak into the light. `width` and `height` are the size
 * the artwork is drawn at; the texture is `spread` larger on every side. At
 * one pixel per css px on purpose: the softness is the point, and canvas
 * shadows ignore the transform a device-pixel canvas would need. Null when
 * the pixels cannot be read.
 */
export function makeSilhouetteGlowTexture(texture, width, height, spread) {
  const source = texture?.source?.resource;
  if (!source || !source.width) {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width + spread * 2));
    canvas.height = Math.max(1, Math.ceil(height + spread * 2));
    const ctx = canvas.getContext('2d');
    const away = canvas.width * 2;
    ctx.shadowColor = '#ffffff';
    ctx.shadowOffsetX = away;
    for (let i = 0; i < 3; i++) {
      ctx.shadowBlur = spread * (0.3 + i * 0.35);
      ctx.drawImage(source, spread - away, spread, width, height);
    }
    // Hollow: the light is round the pack, none of it under it. A cut opens
    // the pack onto the stage behind it, and light hidden under the foil
    // showed through the slit as a line
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(source, spread, spread, width, height);
    return Texture.from(canvas);
  } catch {
    return null;
  }
}

/**
 * A round point of light that fades to nothing at its edge: the head of a
 * spark, an ember, the glow under the blade. White, for the caller to tint.
 */
export function makeSoftDotTexture(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

/**
 * The glint that catches on a glossy card: four thin points of light with a
 * pair of shorter ones between them, pinched at the core. White, for the
 * caller to tint.
 */
export function makeTwinkleTexture(size) {
  const {canvas, ctx} = makeCanvas(size, size);
  const c = size / 2;
  const rays = [
    {angle: 0, length: 1, width: 0.045},
    {angle: Math.PI / 2, length: 1, width: 0.045},
    {angle: Math.PI / 4, length: 0.38, width: 0.03},
    {angle: -Math.PI / 4, length: 0.38, width: 0.03},
  ];
  for (const ray of rays) {
    for (const direction of [1, -1]) {
      const length = c * ray.length * direction;
      const width = c * ray.width;
      const dx = Math.cos(ray.angle) * length;
      const dy = Math.sin(ray.angle) * length;
      const nx = -Math.sin(ray.angle) * width;
      const ny = Math.cos(ray.angle) * width;
      const gradient = ctx.createLinearGradient(c, c, c + dx, c + dy);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.4, 'rgba(255,255,255,0.4)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + dx * 0.12 + nx, c + dy * 0.12 + ny);
      ctx.lineTo(c + dx, c + dy);
      ctx.lineTo(c + dx * 0.12 - nx, c + dy * 0.12 - ny);
      ctx.closePath();
      ctx.fill();
    }
  }
  const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.16);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

/** How many card widths the emblem's light spans — its sprite is sized by it. */
export const EMBLEM_GLOW_SPAN = 0.7;

/**
 * The star printed on the card back, as light: the same shape at the same
 * proportions, blurred out so it can burn through the print while the card
 * charges. White, for the caller to tint.
 */
export function makeEmblemGlowTexture(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  // The printed star is 0.16 card widths out and the diamond 0.21
  const unit = size / EMBLEM_GLOW_SPAN;
  ctx.shadowColor = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    ctx.shadowBlur = unit * (0.02 + i * 0.035);
    starPath(ctx, c, c, unit * 0.16, unit * 0.045, 4);
    ctx.fill();
    ctx.lineWidth = unit * 0.012;
    starPath(ctx, c, c, unit * 0.21, unit * 0.21 * 0.7, 4);
    ctx.stroke();
  }
  return Texture.from(canvas);
}
