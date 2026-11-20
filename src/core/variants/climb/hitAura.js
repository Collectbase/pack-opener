/**
 * The light the hits stand in once they are up: behind each hit, light
 * coming off the edges of its card through smoke, in its colour — two soft
 * hazes of strands breathing against each other and fine bright filaments
 * flickering over them — swelling on every beat of the combo as its card
 * does; and the whole stage filled with a haze of the best colour shown —
 * faint for an ordinary card, warm and full for the hits — until the next
 * ceremony begins. White textures, tinted.
 */
import {Container, Sprite, Texture} from 'pixi.js';
import {mixNumbers} from '../../runtime/color';

/** The light: how far past the card it reaches (as a multiple of the card), and how bright. */
const RAY_REACH = 2.6;
const RAY_ALPHA = 0.95;
/** How it breathes and flickers: by how much, and how fast (radians a second). */
const BREATH = 0.035;
const SWAY = 0.025;
/** How far towards white the fine filaments are. */
const FILAMENT_LIFT = 0.55;
/** How long the rays and the haze take to come up, and to go, in ms of the wall clock. */
const RISE_MS = 280;
const FALL_MS = 220;
/** How much the rays swell with their card's pulse. */
const RAY_PULSE = 0.35;
/** The haze: how far it reaches past the stage, and how thick for an ordinary card and for the hits. */
const HAZE_REACH = 1.5;
export const HAZE = {plain: 0.16, hit: 0.42};

const ease = (from, to, deltaMS, ms) => (to > from ? Math.min(to, from + deltaMS / ms) : Math.max(to, from - deltaMS / ms));

function canvasOf(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return {canvas, ctx: canvas.getContext('2d')};
}

/** The light's shape: the card's share of the texture across, its height against its width, and the texture's size. */
const CARD_SHARE = 1 / RAY_REACH;
const CARD_TALL = 1.4;
const WISP_PX = 512;

/** A seeded random, so the light looks the same every time it is drawn. */
function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Light coming off the edges of a card through smoke: `count` strands, each
 * leaving a point of the card's outline outward — straight off its side,
 * fanned at its corners — most short, a few long, each fading as it goes;
 * drawn `width` px wide and `bright`, plus, when `smoke`, soft clouds along
 * the outline. Drawn small (`scale`) and stretched, the strands come out
 * soft as light in haze; drawn full size, fine as filaments. White, to tint.
 */
function makeWispTexture({seed, count, width, bright, smoke, scale}) {
  const w = Math.round(WISP_PX * scale);
  const h = Math.round(WISP_PX * scale * CARD_TALL);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'lighter';
  const random = seeded(seed);
  const cw = w * CARD_SHARE;
  const ch = h * CARD_SHARE;
  const cx = w / 2;
  const cy = h / 2;
  const reach = Math.min(w, h) / 2;
  const perimeter = 2 * (cw + ch);
  // A point on the outline, and the way out of it: its side's normal, bent towards the corners' diagonal
  const onOutline = at => {
    let d = at * perimeter;
    if (d < cw) return {x: cx - cw / 2 + d, y: cy - ch / 2, nx: 0, ny: -1};
    d -= cw;
    if (d < ch) return {x: cx + cw / 2, y: cy - ch / 2 + d, nx: 1, ny: 0};
    d -= ch;
    if (d < cw) return {x: cx + cw / 2 - d, y: cy + ch / 2, nx: 0, ny: 1};
    d -= cw;
    return {x: cx - cw / 2, y: cy + ch / 2 - d, nx: -1, ny: 0};
  };
  if (smoke) {
    for (let i = 0; i < 46; i++) {
      const p = onOutline(random());
      const out = reach * (0.05 + 0.35 * random());
      const x = p.x + p.nx * out * 0.6;
      const y = p.y + p.ny * out * 0.6;
      const r = reach * (0.12 + 0.22 * random());
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, r);
      cloud.addColorStop(0, `rgba(255,255,255,${0.05 + 0.07 * random()})`);
      cloud.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cloud;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  for (let i = 0; i < count; i++) {
    const p = onOutline(random());
    // Bent towards the way from the middle, so the corners fan out
    let dx = p.nx + ((p.x - cx) / (cw / 2)) * 0.35 + (random() * 2 - 1) * 0.22;
    let dy = p.ny + ((p.y - cy) / (ch / 2)) * 0.35 + (random() * 2 - 1) * 0.22;
    const norm = Math.hypot(dx, dy) || 1;
    dx /= norm;
    dy /= norm;
    // Most short, a few reaching far
    const long = reach * (0.12 + 0.88 * Math.pow(random(), 2.2));
    // From a little inside the card, where it hides the root
    const x0 = p.x - dx * reach * 0.04;
    const y0 = p.y - dy * reach * 0.04;
    const x1 = p.x + dx * long;
    const y1 = p.y + dy * long;
    const alpha = bright * (0.35 + 0.65 * random());
    const strand = ctx.createLinearGradient(x0, y0, x1, y1);
    strand.addColorStop(0, `rgba(255,255,255,${alpha})`);
    strand.addColorStop(0.3, `rgba(255,255,255,${alpha * 0.55})`);
    strand.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = strand;
    ctx.lineWidth = width * (0.5 + random()) * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    // A slight bend, as light through moving air
    const bend = (random() * 2 - 1) * long * 0.08;
    ctx.quadraticCurveTo((x0 + x1) / 2 - dy * bend, (y0 + y1) / 2 + dx * bend, x1, y1);
    ctx.stroke();
  }
  return Texture.from(canvas);
}

/** The light round a hit: two soft hazes of strands that breathe against each other, and fine bright filaments over them. */
function makeWispTextures() {
  return {
    soft: [
      makeWispTexture({seed: 11, count: 170, width: 14, bright: 0.24, smoke: true, scale: 0.4}),
      makeWispTexture({seed: 29, count: 170, width: 14, bright: 0.24, smoke: true, scale: 0.4}),
    ],
    fine: makeWispTexture({seed: 47, count: 260, width: 2.4, bright: 0.32, smoke: false, scale: 1}),
  };
}

/** A soft round light, full in the middle and gone at the edge. */
export function makeHazeTexture(size = 256) {
  const {canvas, ctx} = canvasOf(size);
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

export class HitAuras {
  /** Rays drawn into `rayParent` (under the cards, shaken with them); the haze into `hazeParent` (the stage's back). */
  constructor(rayParent, hazeParent, hazeIndex = 0) {
    this.layer = new Container();
    rayParent.addChild(this.layer);
    this.wisps = makeWispTextures();
    this.haze = new Sprite(makeHazeTexture());
    this.haze.anchor.set(0.5);
    this.haze.blendMode = 'add';
    this.haze.alpha = 0;
    this.haze.visible = false;
    hazeParent.addChildAt(this.haze, Math.min(hazeIndex, hazeParent.children.length));
    // The rays, each with the item it stands behind
    this.auras = [];
    this.hazeTo = 0;
    this.hazeAt = 0;
    this.hazeRank = -1;
    this.clock = 0;
  }

  layout(screen) {
    this.haze.position.set(screen.width / 2, screen.height / 2);
    const reach = Math.max(screen.width, screen.height) * HAZE_REACH;
    this.haze.width = reach;
    this.haze.height = reach;
  }

  /** Light of `color` behind `item`, rising. */
  light(item, color) {
    if (this.auras.some(aura => aura.item === item)) return;
    const node = new Container();
    const layer = (texture, tint) => {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      sprite.tint = tint;
      node.addChild(sprite);
      return sprite;
    };
    const soft = this.wisps.soft.map(texture => layer(texture, color));
    const fine = layer(this.wisps.fine, mixNumbers(color, 0xffffff, FILAMENT_LIFT));
    node.alpha = 0;
    this.layer.addChild(node);
    // Each its own phase, so no two hits breathe together
    this.auras.push({item, node, soft, fine, phase: Math.random() * Math.PI * 2, level: 0, going: false, width: 0, height: 0});
  }

  /** The stage's haze in `color` — kept only when its `rank` beats the one it shows — `thick` as `HAZE` says. */
  tone(color, rank, thick) {
    if (rank < this.hazeRank) return;
    if (rank === this.hazeRank && thick <= this.hazeTo) return;
    this.hazeRank = rank;
    this.haze.tint = color;
    this.hazeTo = Math.max(this.hazeTo, thick);
  }

  /** Everything goes out: the next ceremony begins. */
  fade() {
    for (const aura of this.auras) aura.going = true;
    this.hazeTo = 0;
    this.hazeRank = -1;
  }

  /** Out at once: reset. */
  clear() {
    for (const aura of this.auras) aura.node.destroy({children: true});
    this.auras.length = 0;
    this.hazeTo = 0;
    this.hazeAt = 0;
    this.hazeRank = -1;
    this.haze.alpha = 0;
    this.haze.visible = false;
  }

  /** Coming up or going: the stage is not at rest. Rays that stand only turn at the rate the dust keeps the stage drawn. */
  get live() {
    return this.auras.some(aura => aura.going || aura.level < 1) || this.hazeAt !== this.hazeTo;
  }

  update(wallMS) {
    this.clock += wallMS;
    let kept = 0;
    for (const aura of this.auras) {
      const {item, node, soft, fine, phase} = aura;
      aura.level = ease(aura.level, aura.going ? 0 : 1, wallMS, aura.going ? FALL_MS : RISE_MS);
      if (aura.going && aura.level <= 0) {
        node.destroy({children: true});
        continue;
      }
      // Going, it stays where it stood and as large: the items move on to the next ceremony's places
      if (!aura.going) {
        const box = item.bounds();
        const swell = 1 + RAY_PULSE * item.pulsed;
        aura.width = box.width * RAY_REACH * swell;
        aura.height = box.height * RAY_REACH * swell;
        node.position.set(item.node.position.x, item.node.position.y);
      }
      // The two hazes breathe against each other and sway a touch; the filaments flicker over them
      const t = this.clock / 1000 + phase;
      const breaths = [1 + BREATH * Math.sin(t * 0.9), 1 - BREATH * Math.sin(t * 1.1), 1];
      [...soft, fine].forEach((sprite, k) => {
        sprite.width = aura.width * breaths[k];
        sprite.height = aura.height * breaths[k];
      });
      soft[0].rotation = SWAY * Math.sin(t * 0.7);
      soft[1].rotation = -SWAY * Math.sin(t * 0.8 + 1);
      soft[0].alpha = 0.75 + 0.25 * Math.sin(t * 1.6);
      soft[1].alpha = 0.75 + 0.25 * Math.sin(t * 2.1 + 2);
      fine.alpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.7 + 1));
      node.alpha = RAY_ALPHA * aura.level * (1 - (item.soldness ?? 0) * 0.7);
      this.auras[kept++] = aura;
    }
    this.auras.length = kept;
    this.hazeAt = ease(this.hazeAt, this.hazeTo, wallMS, this.hazeTo > this.hazeAt ? RISE_MS * 2 : FALL_MS * 2);
    this.haze.alpha = this.hazeAt;
    this.haze.visible = this.hazeAt > 0.005;
  }

  destroy() {
    this.clear();
    this.layer.destroy({children: true});
    this.haze.destroy();
    for (const texture of [...this.wisps.soft, this.wisps.fine]) texture.destroy(true);
  }
}
