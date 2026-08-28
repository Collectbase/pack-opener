import {variantOf} from '../variants';
import type {PackOpenerOptions, ResolvedOptions} from './types';

/** Card artwork the scene will wait for, before giving up and finishing. */
const CARD_TIMEOUT_MS = 4000;

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Host options win field by field, so a partial theme keeps the preset's rest. */
function merge<T>(base: T, patch: unknown): T {
  if (!isPlain(patch)) {
    return patch === undefined ? base : (patch as T);
  }
  const out: Plain = {...(base as unknown as Plain)};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    out[key] = isPlain(value) ? merge(out[key], value) : value;
  }
  return out as unknown as T;
}

/**
 * `speed` is a single knob over the whole choreography, so hosts can make the
 * ceremony snappier without re-tuning a dozen numbers by hand. Timeouts are
 * left alone — they are deadlines for the network, not part of the dance.
 */
function applySpeed(motion: ResolvedOptions['motion']): ResolvedOptions['motion'] {
  const speed = motion.speed > 0 ? motion.speed : 1;
  if (speed === 1) {
    return motion;
  }
  const scale = (ms: number) => Math.max(1, Math.round(ms / speed));
  return {
    ...motion,
    // Baked into the durations above, so resolving an already-resolved object
    // is a no-op instead of speeding everything up a second time
    speed: 1,
    introMs: scale(motion.introMs),
    finishMs: scale(motion.finishMs),
    autoSliceMs: scale(motion.autoSliceMs),
    retractMs: scale(motion.retractMs),
    open: {...motion.open, ms: scale(motion.open.ms)},
    reveal: {
      ...motion.reveal,
      spinMs: scale(motion.reveal.spinMs),
      unveilMs: scale(motion.reveal.unveilMs),
      beamMs: scale(motion.reveal.beamMs),
      holdMs: scale(motion.reveal.holdMs),
      artWaitSpinMs: scale(motion.reveal.artWaitSpinMs),
    },
  };
}

/**
 * Fills a host's options in from the chosen variant's preset. This is the only
 * place defaults live: the scene and both wrappers read the resolved object, so
 * they can never disagree about what a missing field means.
 */
export function resolveOptions(options: PackOpenerOptions): ResolvedOptions {
  const variant = variantOf(options.variant);
  const presetName = options.preset ?? variant.defaultPreset;
  const preset = (variant.presets[presetName] ??
    variant.presets[variant.defaultPreset]) as ResolvedOptions;

  const resolved = {
    variant: variant.id,
    preset: presetName,
    assets: {
      pack: {url: options.assets?.pack?.url ?? ''},
      card: {
        url: options.assets?.card?.url ?? '',
        timeoutMs: options.assets?.card?.timeoutMs ?? CARD_TIMEOUT_MS,
      },
    },
    theme: merge(preset.theme, options.theme),
    motion: merge(preset.motion, options.motion),
    interaction: merge(preset.interaction, options.interaction),
    layout: merge(preset.layout, options.layout),
    hint: merge(preset.hint, options.hint),
    performance: merge(preset.performance, options.performance),
  } as ResolvedOptions;

  resolved.motion = applySpeed(resolved.motion);
  return resolved;
}
