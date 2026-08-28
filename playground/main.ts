import {createPackOpener, resolveOptions} from '../src/core';
import type {PackOpenerInstance, PackOpenerOptions} from '../src/core';

/**
 * Playground for the pack-opening animation: every knob in the public schema,
 * wired live. It talks to `core` directly — no React — which is also the point:
 * the engine is framework-agnostic.
 */

type Control =
  | {kind: 'range'; path: string; label: string; min: number; max: number; step: number}
  | {kind: 'color'; path: string; label: string}
  | {kind: 'text'; path: string; label: string};

const GROUPS: {title: string; controls: Control[]}[] = [
  {
    title: 'Assets',
    controls: [
      {kind: 'text', path: 'assets.pack.url', label: 'Pack image URL'},
      {kind: 'text', path: 'assets.card.url', label: 'Card image URL'},
    ],
  },
  {
    title: 'Theme',
    controls: [
      {kind: 'color', path: 'theme.glow', label: 'Rarity glow'},
      {kind: 'color', path: 'theme.beam', label: 'Beam'},
      {kind: 'color', path: 'theme.hint', label: 'Hint comet'},
      {kind: 'range', path: 'theme.cornerRadius', label: 'Card corner radius', min: 0, max: 40, step: 1},
    ],
  },
  {
    title: 'Motion',
    controls: [
      {kind: 'range', path: 'motion.speed', label: 'Speed ×', min: 0.25, max: 4, step: 0.05},
      {kind: 'range', path: 'motion.open.ms', label: 'Lid + slide out, ms', min: 300, max: 2500, step: 50},
      {kind: 'range', path: 'motion.reveal.spinMs', label: 'Spin, ms', min: 400, max: 6000, step: 100},
      {kind: 'range', path: 'motion.reveal.unveilMs', label: 'Unveil, ms', min: 100, max: 2000, step: 50},
      {kind: 'range', path: 'motion.reveal.beamMs', label: 'Beam, ms', min: 100, max: 2500, step: 50},
      {kind: 'range', path: 'motion.reveal.sparks', label: 'Sparks', min: 0, max: 80, step: 1},
    ],
  },
  {
    title: 'Interaction',
    controls: [
      {kind: 'range', path: 'interaction.activation', label: 'Activation, px', min: 0, max: 60, step: 1},
      {kind: 'range', path: 'interaction.completeFraction', label: 'Commit at, share of width', min: 0.2, max: 0.95, step: 0.01},
      {kind: 'range', path: 'interaction.gapRatio', label: 'Cut gap', min: 0, max: 0.08, step: 0.002},
      {kind: 'range', path: 'interaction.edgeJitter', label: 'Ragged edge', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'interaction.band.top', label: 'Cut band top', min: 0, max: 0.6, step: 0.01},
      {kind: 'range', path: 'interaction.band.bottom', label: 'Cut band bottom', min: 0.2, max: 1, step: 0.01},
    ],
  },
  {
    title: 'Lid & wrapper',
    controls: [
      {kind: 'range', path: 'motion.open.lid', label: 'Lid share of timeline', min: 0.1, max: 0.9, step: 0.01},
      {kind: 'range', path: 'motion.open.lidThrowX', label: 'Lid throw sideways', min: 0, max: 2, step: 0.05},
      {kind: 'range', path: 'motion.open.lidThrowY', label: 'Lid throw up', min: 0, max: 2, step: 0.05},
      {kind: 'range', path: 'motion.open.lidSpin', label: 'Lid tumble, rad', min: -2, max: 2, step: 0.05},
      {kind: 'range', path: 'motion.open.cardFrom', label: 'Card starts at', min: 0.05, max: 0.9, step: 0.01},
      {kind: 'range', path: 'motion.open.sink', label: 'Wrapper sink', min: 0, max: 1.5, step: 0.05},
      {kind: 'range', path: 'motion.open.gone', label: 'Wrapper gone by', min: 0.2, max: 1, step: 0.01},
    ],
  },
  {
    title: 'Card & glows',
    controls: [
      {kind: 'range', path: 'motion.reveal.spinTurns', label: 'Turns', min: 0.5, max: 6, step: 0.5},
      {kind: 'range', path: 'motion.reveal.spinFlatness', label: 'Edge-on thinness', min: 0.01, max: 0.4, step: 0.01},
      {kind: 'range', path: 'motion.reveal.spinShade', label: 'Edge-on shading', min: 0, max: 0.5, step: 0.01},
      {kind: 'color', path: 'theme.rim', label: 'Rim'},
      {kind: 'color', path: 'theme.bloom', label: 'Bloom'},
      {kind: 'range', path: 'motion.reveal.haloAlpha', label: 'Halo opacity', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'motion.reveal.bloomAlpha', label: 'Bloom opacity', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'layout.glow.haloPadding', label: 'Halo reach, px', min: 0, max: 300, step: 4},
      {kind: 'range', path: 'layout.glow.haloSpread', label: 'Halo softness', min: 4, max: 160, step: 4},
      {kind: 'range', path: 'layout.glow.rimPadding', label: 'Rim reach, px', min: 0, max: 200, step: 4},
      {kind: 'range', path: 'layout.glow.bloomScaleX', label: 'Bloom width ×', min: 1, max: 6, step: 0.1},
      {kind: 'range', path: 'layout.glow.bloomScaleY', label: 'Bloom height ×', min: 1, max: 6, step: 0.1},
    ],
  },
  {
    title: 'Beam & sparks',
    controls: [
      {kind: 'range', path: 'motion.reveal.beamTail', label: 'Beam tail', min: 0.05, max: 1, step: 0.01},
      {kind: 'range', path: 'motion.reveal.beamWidth', label: 'Beam width, px', min: 1, max: 12, step: 0.5},
      {kind: 'range', path: 'motion.reveal.beamGlowWidth', label: 'Beam glow, px', min: 0, max: 40, step: 1},
      {kind: 'range', path: 'motion.reveal.beamGlowAlpha', label: 'Beam glow opacity', min: 0, max: 1, step: 0.02},
      {kind: 'range', path: 'motion.reveal.beamTipRadius', label: 'Beam tip, px', min: 0, max: 24, step: 1},
      {kind: 'color', path: 'theme.spark', label: 'Sparks'},
      {kind: 'range', path: 'motion.reveal.sparkSize', label: 'Spark size', min: 0.2, max: 6, step: 0.1},
      {kind: 'range', path: 'motion.reveal.sparkJitter', label: 'Spark size spread', min: 0, max: 8, step: 0.1},
      {kind: 'range', path: 'motion.reveal.sparkSpreadX', label: 'Spark scatter x, px', min: 0, max: 30, step: 1},
      {kind: 'range', path: 'motion.reveal.sparkSpreadY', label: 'Spark scatter y, px', min: 0, max: 30, step: 1},
    ],
  },
  {
    title: 'Layout',
    controls: [
      {kind: 'range', path: 'layout.pack.widthRatio', label: 'Pack width / stage', min: 0.3, max: 1, step: 0.01},
      {kind: 'range', path: 'layout.pack.heightRatio', label: 'Pack height / stage', min: 0.3, max: 1, step: 0.01},
      {kind: 'range', path: 'layout.pack.offsetY', label: 'Pack offset down', min: -0.3, max: 0.3, step: 0.01},
      {kind: 'range', path: 'layout.card.heightRatio', label: 'Card height / pack', min: 0.4, max: 1.4, step: 0.01},
      {kind: 'range', path: 'layout.card.packWidthRatio', label: 'Card width / pack', min: 0.3, max: 1.2, step: 0.01},
      {kind: 'range', path: 'layout.card.maxRatio', label: 'Card widest ratio', min: 0.4, max: 1.6, step: 0.02},
    ],
  },
  {
    title: 'Hint & auto cut',
    controls: [
      {kind: 'range', path: 'hint.lineRatio', label: 'Hint line', min: 0, max: 0.6, step: 0.01},
      {kind: 'range', path: 'hint.sweep', label: 'Hint sweep', min: 0.2, max: 1, step: 0.01},
      {kind: 'range', path: 'hint.tail', label: 'Hint tail', min: 0, max: 1, step: 0.02},
      {kind: 'range', path: 'hint.headRadius', label: 'Hint head, px', min: 1, max: 24, step: 1},
      {kind: 'range', path: 'hint.tailAlpha', label: 'Hint tail opacity', min: 0, max: 1, step: 0.05},
      {kind: 'range', path: 'hint.tailFalloff', label: 'Hint tail falloff', min: 0.5, max: 4, step: 0.1},
      {kind: 'range', path: 'hint.loopMs', label: 'Hint loop, ms', min: 400, max: 4000, step: 100},
      {kind: 'range', path: 'hint.idleMs', label: 'Hint pause, ms', min: 0, max: 3000, step: 100},
      {kind: 'range', path: 'interaction.autoArc.fromY', label: 'Auto cut starts at', min: 0, max: 0.8, step: 0.01},
      {kind: 'range', path: 'interaction.autoArc.controlY', label: 'Auto cut bend', min: -0.2, max: 0.8, step: 0.01},
    ],
  },
];

/** Stand-in artwork so the playground works with no assets at hand. */
function placeholder(w: number, h: number, label: string, from: string, to: string) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold ${Math.round(w / 9)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, w / 2, h / 2);
  return canvas.toDataURL();
}

const DEFAULTS = {
  pack: placeholder(620, 900, 'PACK', '#2b4c9b', '#8b1e3f'),
  card: placeholder(420, 640, 'CARD', '#f4f6ff', '#c9d2f0'),
};

const options: PackOpenerOptions = {
  assets: {pack: {url: DEFAULTS.pack}, card: {url: DEFAULTS.card}},
};

// Resolved once so the panel opens on the preset's own values
const RESOLVED_PREVIEW = resolveOptions({assets: {pack: {url: ''}}});

const get = (path: string): unknown =>
  path.split('.').reduce<any>((node, key) => (node == null ? node : node[key]), options);

const set = (path: string, value: unknown) => {
  const keys = path.split('.');
  const last = keys.pop()!;
  let node: any = options;
  for (const key of keys) {
    node[key] = node[key] ?? {};
    node = node[key];
  }
  node[last] = value;
};

const stage = document.querySelector<HTMLElement>('#stage')!;
const log = document.querySelector<HTMLOListElement>('#log')!;

let instance: PackOpenerInstance | null = null;
let generation = 0;

function note(text: string) {
  const li = document.createElement('li');
  li.textContent = text;
  log.prepend(li);
  while (log.children.length > 40) {
    log.lastElementChild?.remove();
  }
}

async function mount() {
  const mine = ++generation;
  instance?.destroy();
  instance = null;
  stage.replaceChildren();

  try {
    const created = await createPackOpener(stage, options, {
      onEvent: event => {
        const extra =
          event.type === 'tick' ? ` ${Number(event.progress).toFixed(2)}` : '';
        note(`${event.type}${extra}`);
      },
    });
    if (mine !== generation) {
      created.destroy();
      return;
    }
    instance = created;
  } catch (error) {
    note(`failed: ${String((error as Error)?.message || error)}`);
  }
}

// Applied to the running scene, so dragging a slider does not restart the
// ceremony; if the change needs a new scene the engine says so and we remount.
let pending: number | undefined;
const apply = () => {
  window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    if (!instance || !instance.setOptions(options)) {
      void mount();
    }
  }, 120);
};

function buildPanel() {
  const host = document.querySelector<HTMLElement>('#controls')!;

  for (const group of GROUPS) {
    const section = document.createElement('div');
    section.className = 'group';
    const title = document.createElement('h2');
    title.textContent = group.title;
    section.append(title);

    for (const control of group.controls) {
      const label = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = control.label;
      label.append(name);

      if (control.kind === 'range') {
        const value = document.createElement('span');
        value.className = 'value';
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(control.min);
        input.max = String(control.max);
        input.step = String(control.step);
        const current = Number(get(control.path) ?? resolvedDefault(control.path));
        input.value = String(current);
        value.textContent = String(current);
        input.addEventListener('input', () => {
          value.textContent = input.value;
          set(control.path, Number(input.value));
          apply();
        });
        label.append(value, input);
      } else if (control.kind === 'color') {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = String(get(control.path) ?? resolvedDefault(control.path));
        input.addEventListener('input', () => {
          set(control.path, input.value);
          apply();
        });
        label.append(input);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'https://…  (empty = built-in placeholder)';
        input.addEventListener('change', () => {
          const url = input.value.trim();
          set(
            control.path,
            url || (control.path.includes('pack') ? DEFAULTS.pack : DEFAULTS.card),
          );
          apply();
        });
        label.append(input);
      }

      section.append(label);
    }
    host.append(section);
  }
}

/** Sliders need a starting number even before the host has set one. */
function resolvedDefault(path: string): number | string {
  return (
    path.split('.').reduce<any>((node, key) => node?.[key], RESOLVED_PREVIEW) ?? 0
  );
}

document.querySelector('#replay')!.addEventListener('click', () => instance?.reset());
document.querySelector('#auto')!.addEventListener('click', () => instance?.autoSlice());

buildPanel();
mount();
