import {variantOf} from '../variants';
import type {PackOpenerOptions, ResolvedOptions, RestOptions} from './types';

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
      holdMs: scale(motion.reveal.holdMs),
      artWaitSpinMs: scale(motion.reveal.artWaitSpinMs),
    },
  };
}

/**
 * `speed` is one knob over the whole ceremony, so a mechanic's own durations
 * have to answer to it too — otherwise a host that asked for a snappier open
 * gets a snappy reveal bolted onto a charge that still takes its time.
 */
function scaleDurations<T extends object>(group: T, speed: number, keys: (keyof T)[]): T {
  if (speed === 1) {
    return group;
  }
  const out = {...group};
  for (const key of keys) {
    const value = out[key];
    if (typeof value === 'number') {
      out[key] = Math.max(1, Math.round(value / speed)) as T[keyof T];
    }
  }
  return out;
}

/**
 * Fills a host's options in from the chosen variant's preset. This is the only
 * place defaults live: the scene and both wrappers read the resolved object, so
 * they can never disagree about what a missing field means.
 */
const finite = (...values: unknown[]) => values.every(v => typeof v === 'number' && Number.isFinite(v));

/** Only the boxes given in full; the rest of `rest` is dropped. */
function restOf(rest: RestOptions): RestOptions {
  const out: RestOptions = {};
  const card = rest.card;
  if (card && finite(card.left, card.top, card.width, card.height) && card.width > 0 && card.height > 0) {
    out.card = {left: card.left, top: card.top, width: card.width, height: card.height};
  }
  const pedestal = rest.pedestal;
  if (pedestal && finite(pedestal.left, pedestal.width, pedestal.bottom) && pedestal.width > 0) {
    out.pedestal = {left: pedestal.left, width: pedestal.width, bottom: pedestal.bottom};
  }
  return out;
}

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
        // Only what can be shown: a fact with nothing to say is dropped
        facts: (options.assets?.card?.facts ?? []).filter(
          fact => fact && String(fact.value ?? '').trim() && String(fact.label ?? '').trim(),
        ),
        ...(options.assets?.card?.badge?.label
          ? {
              badge: {
                label: options.assets.card.badge.label,
                color: options.assets.card.badge.color ?? '#f5d000',
              },
            }
          : {}),
      },
      // Empty means "the one baked into the package" — the scene decides, so a
      // host that has no stand of its own passes nothing
      pedestal: {url: options.assets?.pedestal?.url ?? ''},
    },
    theme: merge(preset.theme, options.theme),
    motion: merge(preset.motion, options.motion),
    layout: merge(preset.layout, options.layout),
    // The host's own, whole or not at all: a box with a side missing is no box
    ...(options.rest ? {rest: restOf(options.rest)} : {}),
    performance: merge(preset.performance, options.performance),
    // Only for the mechanic that owns them: a preset without `interaction` has
    // no cut to read, one without `charge` has no pressure to build. Filling
    // them in regardless would hand every scene numbers for an animation it
    // is not, and a host tuning the wrong group would see nothing happen.
    interaction: preset.interaction
      ? merge(preset.interaction, options.interaction)
      : undefined,
    hint: preset.hint ? merge(preset.hint, options.hint) : undefined,
    slice: preset.slice ? merge(preset.slice, options.slice) : undefined,
    charge: preset.charge ? merge(preset.charge, options.charge) : undefined,
    burst: preset.burst ? merge(preset.burst, options.burst) : undefined,
    carousel: preset.carousel
      ? merge(preset.carousel, options.carousel)
      : undefined,
  } as ResolvedOptions;

  // Read before `applySpeed`, which bakes the factor in and resets it to 1
  const speed = resolved.motion.speed > 0 ? resolved.motion.speed : 1;
  resolved.motion = applySpeed(resolved.motion);
  if (resolved.slice) {
    resolved.slice = scaleDurations(resolved.slice, speed, [
      'floatMs',
      'foilEveryMs',
      'foilMs',
      'sparkLifeMs',
      'chargeMs',
      'chargeWaitMs',
      'tiltMs',
      'flipMs',
      'landMs',
      'twinkleMs',
      'emberMs',
    ]);
  }
  if (resolved.charge) {
    resolved.charge = scaleDurations(resolved.charge, speed, [
      'holdMs',
      'releaseMs',
      'breatheMs',
    ]);
  }
  if (resolved.burst) {
    resolved.burst = scaleDurations(resolved.burst, speed, [
      'flashMs',
      'beatMs',
      'shardMs',
      'spikeMs',
      'ringMs',
      'debrisMs',
      'glitterMs',
      'swarmMs',
      'assembleMs',
      'snapMs',
    ]);
  }
  if (resolved.carousel) {
    resolved.carousel = scaleDurations(resolved.carousel, speed, [
      'shuffleMs',
      'dropMs',
      'riseMs',
      'dissolveMs',
      'factMs',
      'factGapMs',
      'bannerMs',
      'bannerHoldMs',
      'flipMs',
      'settleMs',
      'hoverMs',
    ]);
  }
  return resolved;
}
