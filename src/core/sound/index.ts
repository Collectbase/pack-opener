import {MESSAGES} from '../config/protocol';
import type {ResolvedOptions, VariantName} from '../config/types';
import {createScore, landingTierFor, type SceneTimeline} from './cues';
import {createSoundEngine} from './engine';

type Sound = ResolvedOptions['sound'];

/** The ceremony's sound, as the engine drives it — see `createSound`. */
export interface SceneSound {
  /** A message the scene posts, heard before the host hears it. */
  hear(type: string, payload?: Record<string, unknown>): void;
  /** The host's sound options, live: a mute mid-ceremony silences what is playing. */
  set(sound: Sound): void;
  /** A touch on the stage: the moment a browser lets the context start. */
  unlock(): void;
  /** The scene was wound back: nothing cued for the old run may sound. */
  reset(): void;
  destroy(): void;
}

async function decode(context: AudioContext, uri: string): Promise<AudioBuffer> {
  const binary = atob(uri.slice(uri.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return context.decodeAudioData(bytes.buffer);
}

/**
 * Scores one scene from its own messages — the same ones the host is sent —
 * so a host turns sound on with an option and wires nothing. Off, nothing is
 * made: no context, and the baked sounds (`samples.js`, a chunk of its own on
 * the web) are not even loaded. The first time it is on they are decoded,
 * and the score plays from whatever the scene does next.
 */
export function createSound(variant: VariantName, initial: Sound): SceneSound {
  const engine = createSoundEngine();
  let current = initial;
  let loading = false;
  const score = createScore(engine, variant, () => landingTierFor(current.badge));

  const load = () => {
    if (loading) return;
    loading = true;
    void import('./samples')
      .then(async ({default: samples}) => {
        const context = engine.context;
        if (!context) return;
        await Promise.all(
          Object.entries(samples).map(async ([cue, uri]) => {
            try {
              engine.register(cue, await decode(context, uri));
            } catch {
              /* a cue that will not decode stays silent */
            }
          }),
        );
      })
      .catch(() => {});
  };

  const set = (sound: Sound) => {
    current = sound;
    engine.setLevel(sound.enabled && !sound.muted ? sound.volume : 0);
    if (sound.enabled) load();
  };
  set(initial);

  return {
    hear(type, payload = {}) {
      switch (type) {
        case MESSAGES.TIMELINE:
          score.onEvent({type: 'timeline', timeline: payload as SceneTimeline});
          break;
        case MESSAGES.INTERACTION_START:
          score.onEvent({type: 'interactionStart'});
          break;
        case MESSAGES.TICK:
          score.onEvent({type: 'tick', progress: Number(payload.progress) || 0});
          break;
        case MESSAGES.RETRACTED:
          score.onEvent({type: 'cancel'});
          break;
        case MESSAGES.PHASE:
          score.onEvent({
            type: 'phase',
            name: String(payload.name),
            durationMs: Number(payload.durationMs) || 0,
          });
          break;
        case MESSAGES.OPENED:
          score.onEvent({type: 'opened'});
          break;
        case MESSAGES.REVEALED:
          score.onEvent({type: 'revealed'});
          break;
        default:
          break;
      }
    },
    set,
    unlock() {
      if (current.enabled) engine.unlock();
    },
    reset() {
      score.onEvent({type: 'reset'});
    },
    destroy() {
      score.dispose();
      engine.close();
    },
  };
}
