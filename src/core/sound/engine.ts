/**
 * The ceremony's sound engine: one Web Audio context per scene, a master level
 * and the decoded cues, played by name. Every call is a silent no-op where
 * Web Audio is missing or refused — sound is a garnish, never a reason for the
 * ceremony to fail.
 *
 * A browser holds audio back until a gesture: `unlock()` resumes the context
 * and the scene calls it on every pointer down, and every cue is downstream of
 * a touch anyway. The React Native wrapper lets its WebView play without one,
 * so a pack opened by `autoSlice` is heard too.
 */

export interface PlayOptions {
  /** The voice's level before the master's: 1 as the file was levelled, more to lift a quiet one. */
  gain?: number;
  /** Playback rate; 1 = as recorded. */
  rate?: number;
  loop?: boolean;
  /** Ramp the voice in over this long instead of starting at full gain. */
  fadeInMs?: number;
  /** Start this much later; for a second cue timed against a first. */
  delayMs?: number;
}

export interface Voice {
  stop(fadeMs?: number): void;
  setGain(value: number, rampMs?: number): void;
  setRate(value: number, rampMs?: number): void;
}

export interface SoundEngine {
  /** The context, made on first use — decoding needs one as well. */
  readonly context: AudioContext | null;
  /** Create or resume the context — only worth calling inside a gesture. */
  unlock(): void;
  /** Master level 0..1: the host's volume, or 0 when muted. */
  setLevel(level: number): void;
  register(cue: string, buffer: AudioBuffer): void;
  has(cue: string): boolean;
  /** How long `cue` runs as recorded, in ms; 0 for one not in the bank. */
  duration(cue: string): number;
  play(cue: string, options?: PlayOptions): Voice | null;
  stopAll(fadeMs?: number): void;
  close(): void;
}

const MIN_GAIN = 0.0001;
/** The most voices of one cue at once: a ninth stop or pop takes the oldest one's place rather than piling up. */
const VOICES_PER_CUE = 3;
/** The limiter at the end of the chain, so cues landing together never clip. */
const LIMITER = {threshold: -3, knee: 3, ratio: 12, attack: 0.003, release: 0.15};

function makeContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ??
    (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
  if (!Ctx) return null;
  // Safari's Audio Session API: ambient, so the ringer switch silences the
  // ceremony and the player's own music plays on under it
  const session = (navigator as unknown as {audioSession?: {type: string}}).audioSession;
  if (session) {
    try {
      session.type = 'ambient';
    } catch {
      /* a session that cannot be set is the browser's default */
    }
  }
  try {
    return new Ctx({latencyHint: 'interactive'});
  } catch {
    return null;
  }
}

export function createSoundEngine(): SoundEngine {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let level = 1;
  let closed = false;
  const buffers = new Map<string, AudioBuffer>();
  const voices = new Set<Voice>();
  const byCue = new Map<string, Voice[]>();
  // When each voice starts sounding (context time); a delayed cue is queued, not yet heard.
  const startsAt = new WeakMap<Voice, number>();

  const ensure = (): AudioContext | null => {
    if (context || closed) return context;
    context = makeContext();
    if (!context) return null;
    master = context.createGain();
    master.gain.value = level;
    let out: AudioNode = context.destination;
    try {
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = LIMITER.threshold;
      limiter.knee.value = LIMITER.knee;
      limiter.ratio.value = LIMITER.ratio;
      limiter.attack.value = LIMITER.attack;
      limiter.release.value = LIMITER.release;
      limiter.connect(context.destination);
      out = limiter;
    } catch {
      /* no compressor in this context: straight out */
    }
    master.connect(out);
    return context;
  };

  return {
    get context() {
      return ensure();
    },
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
    },
    setLevel(next) {
      level = Math.min(1, Math.max(0, next));
      if (master && context) {
        master.gain.setTargetAtTime(level, context.currentTime, 0.02);
      }
    },
    register(cue, buffer) {
      buffers.set(cue, buffer);
    },
    has(cue) {
      return buffers.has(cue);
    },
    duration(cue) {
      const buffer = buffers.get(cue);
      return buffer ? buffer.duration * 1000 : 0;
    },
    play(cue, options = {}) {
      const buffer = buffers.get(cue);
      if (!buffer || level <= 0) return null;
      const ctx = ensure();
      if (!ctx || !master) return null;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = options.loop ?? false;
      source.playbackRate.value = options.rate ?? 1;
      const gain = ctx.createGain();
      const target = options.gain ?? 1;
      const at = ctx.currentTime + (options.delayMs ?? 0) / 1000;
      if (options.fadeInMs) {
        gain.gain.setValueAtTime(MIN_GAIN, at);
        gain.gain.linearRampToValueAtTime(target, at + options.fadeInMs / 1000);
      } else {
        gain.gain.setValueAtTime(target, at);
      }
      source.connect(gain);
      gain.connect(master);
      source.start(at);

      let live = true;
      const voice: Voice = {
        stop(fadeMs = 0) {
          if (!live) return;
          live = false;
          voices.delete(voice);
          const now = ctx.currentTime;
          if (fadeMs > 0) {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(Math.max(MIN_GAIN, gain.gain.value), now);
            gain.gain.exponentialRampToValueAtTime(MIN_GAIN, now + fadeMs / 1000);
            source.stop(now + fadeMs / 1000 + 0.01);
          } else {
            source.stop(now);
          }
        },
        setGain(value, rampMs = 40) {
          if (!live) return;
          gain.gain.setTargetAtTime(Math.max(MIN_GAIN, value), ctx.currentTime, rampMs / 1000);
        },
        setRate(value, rampMs = 40) {
          if (!live) return;
          source.playbackRate.setTargetAtTime(value, ctx.currentTime, rampMs / 1000);
        },
      };
      const same = byCue.get(cue) ?? [];
      byCue.set(cue, same);
      source.onended = () => {
        live = false;
        voices.delete(voice);
        const at = same.indexOf(voice);
        if (at >= 0) same.splice(at, 1);
      };
      voices.add(voice);
      same.push(voice);
      startsAt.set(voice, at);
      if (same.length > VOICES_PER_CUE) {
        // Only a voice already sounding gives way: cues scheduled ahead on purpose (the carousel's whoosh per fact)
        // all play
        const oldest = same.find((v) => (startsAt.get(v) ?? 0) <= ctx.currentTime);
        if (oldest) {
          same.splice(same.indexOf(oldest), 1);
          oldest.stop(30);
        }
      }
      return voice;
    },
    stopAll(fadeMs = 0) {
      for (const voice of [...voices]) voice.stop(fadeMs);
    },
    close() {
      closed = true;
      voices.clear();
      byCue.clear();
      void context?.close().catch(() => {});
      context = null;
      master = null;
    },
  };
}
