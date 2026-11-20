import type {SoundDesign, VariantName} from '../config/types';
import type {PlayOptions, SoundEngine, Voice} from './engine';

/**
 * How long each phase runs, as the scene announces it (the library's
 * `timeline` event, with `ready` and after every retune). What it leaves out
 * falls back to the presets below.
 */
export type SceneTimeline = Partial<
  Record<
    | 'spinMs'
    | 'unveilMs'
    | 'beamMs'
    | 'holdMs'
    | 'chargeHoldMs'
    | 'releaseMs'
    | 'beatMs'
    | 'swarmMs'
    | 'assembleMs'
    | 'snapMs'
    | 'shuffleMs'
    | 'dropMs'
    | 'riseMs'
    | 'dissolveMs'
    | 'factMs'
    | 'factGapMs'
    | 'bannerMs'
    | 'bannerHoldMs'
    | 'flipMs',
    number
  >
>;

/** What the scene tells the score, in the order the ceremony emits it. */
export type SceneEvent =
  | {type: 'timeline'; timeline: SceneTimeline}
  | {type: 'interactionStart'}
  | {type: 'tick'; progress: number}
  | {type: 'cancel'}
  | {type: 'phase'; name: string; durationMs?: number}
  | {type: 'opened'}
  | {type: 'revealed'}
  | {type: 'cardSettled'; index: number; colorIndex?: number; skipped?: boolean}
  | {type: 'cardRevealed'; index: number; skipped?: boolean}
  | {type: 'hitsRevealed'; skipped?: boolean}
  | {type: 'allRevealed'; skipped?: boolean}
  /** A moment the scene, or its host, says a sound may mark (`MESSAGES.CUE`), with a number it may carry. */
  | {type: 'cue'; name: string; index: number; value?: number}
  /** The scene was wound back to the start: nothing cued for the old run may sound. */
  | {type: 'reset'};

/** Preset lengths of the phases the scores anchor to, for when the scene has not said. */
const DEFAULT_SPIN_MS = 3400;
const DEFAULT_UNVEIL_MS = 600;
const DEFAULT_BEAM_MS = 800;
const DEFAULT_HOLD_MS = 1100;
const DEFAULT_SWARM_MS = 520;
const DEFAULT_ASSEMBLE_MS = 1400;
const DEFAULT_SNAP_MS = 420;
const DEFAULT_FACT_MS = 320;
const DEFAULT_FACT_GAP_MS = 700;

/**
 * The reveal and the blast are produced recordings (see
 * `assets/sounds/CREDITS.md`), and the score works around their own timing:
 * the sweep is started this long before the card lands; the impact file rises
 * for `IMPACT_RISE_MS` before it hits and the blast file whooshes for
 * `BLAST_RISE_MS` before its impact, so each is started that much early to
 * hit on its frame.
 */
const SWEEP_LEAD_MS = 2000;
const IMPACT_RISE_MS = 940;
const BLAST_RISE_MS = 570;

/** The burst's own sweep, impact and magic, where the bank (or the host) has them; the slice's otherwise. */
const own = (engine: SoundEngine, cue: string, shared: string) => (engine.has(cue) ? cue : shared);

/**
 * When the turning card passes edge-on, as fractions of the spin. The scene
 * turns it `SPIN_TURNS` times over an ease-in-out, so the edges bunch up
 * around the middle: the inverse of that easing at every half turn.
 */
const SPIN_TURNS = 2;
const EDGE_ON = Array.from({length: SPIN_TURNS * 2}, (_, k) => {
  const f = (k + 0.5) / (SPIN_TURNS * 2);
  return f < 0.5 ? Math.cbrt(f / 4) : 1 - Math.cbrt((1 - f) / 4);
});
/** A spin shorter than this (the wait for late artwork) turns too fast to swish. */
const MIN_SWISH_SPIN_MS = 1200;

/** How big the pull is, from its badge: it decides how hard the landing hits. */
export type LandingTier = 'common' | 'rare' | 'epic' | 'grail';

const TIERS: Record<string, LandingTier> = {
  Grail: 'grail',
  Chase: 'grail',
  'Big Hit': 'grail',
  Epic: 'epic',
  Rare: 'rare',
};

export function landingTierFor(badge: string | null | undefined): LandingTier {
  return (badge && TIERS[badge]) || 'common';
}

const IMPACT_GAIN: Record<LandingTier, number> = {common: 0.6, rare: 0.8, epic: 1, grail: 1};

export interface Score {
  onEvent(event: SceneEvent): void;
  /** The scene is going: everything still sounding or scheduled stops. */
  dispose(): void;
}

/** Voices to stop when the scene goes; `play` returns null before the unlock. */
function keep(list: Voice[], voice: Voice | null): void {
  if (voice) list.push(voice);
}

function stopAll(list: Voice[], fadeMs: number): void {
  for (const voice of list) voice.stop(fadeMs);
  list.length = 0;
}

/**
 * The slice score, kept sparse — every cue is a thing on screen. The foil
 * tears under the finger; one dark hit as the lid goes; a swish of air each
 * time the turning card passes edge-on; then the reveal: the sweep building
 * from the last turn, the impact rising through the beam to hit as the card
 * lands, the magic on the landing frame. Silence in between.
 */
function sliceScore(engine: SoundEngine, tier: () => LandingTier): Score {
  let timeline: SceneTimeline = {};
  let tear: Voice | null = null;
  let sweep: Voice | null = null;
  // The card is turning on for late artwork: the sweep is owed at the unveil
  let held = false;
  const swishes: Voice[] = [];
  const landing: Voice[] = [];

  const startTear = (gain: number) => {
    tear?.stop(60);
    tear = engine.play('pack-open', {gain, fadeInMs: 20});
  };
  const stopTear = (fadeMs: number) => {
    tear?.stop(fadeMs);
    tear = null;
  };

  return {
    onEvent(event) {
      switch (event.type) {
        case 'timeline':
          timeline = event.timeline;
          break;
        case 'interactionStart':
          startTear(0.8);
          break;
        case 'tick':
          // The cut drags the recording along with the finger
          tear?.setRate(0.9 + 0.25 * event.progress, 120);
          break;
        case 'cancel':
          stopTear(150);
          break;
        case 'phase':
          switch (event.name) {
            case 'autoSlice':
              // The RIP! path announces the touch first, so the tear may already run
              if (!tear) startTear(1);
              break;
            case 'open':
              stopTear(120);
              engine.play('whoosh-deep', {gain: 0.7});
              engine.play('sub-hit', {gain: 0.55, delayMs: 40});
              break;
            case 'spin': {
              const spinMs = event.durationMs || DEFAULT_SPIN_MS;
              const unveilMs = timeline.unveilMs ?? DEFAULT_UNVEIL_MS;
              const beamMs = timeline.beamMs ?? DEFAULT_BEAM_MS;
              // The sweep leads the landing by a fixed time, so it is cued from
              // the spin
              sweep?.stop(0);
              sweep = engine.play('reveal-sweep', {
                gain: 1,
                delayMs: Math.max(0, spinMs + unveilMs + beamMs - SWEEP_LEAD_MS),
              });
              held = false;
              if (spinMs < MIN_SWISH_SPIN_MS) break;
              for (const [k, fraction] of EDGE_ON.entries()) {
                keep(
                  swishes,
                  engine.play('swish', {
                    gain: 0.45 + (k % 2) * 0.1,
                    rate: 1 + (k % 2) * 0.12,
                    delayMs: Math.round(fraction * spinMs),
                  }),
                );
              }
              break;
            }
            case 'spinHold':
              // The artwork is late and the card turns on at a steady speed,
              // for as long as it takes — one announcement for the whole wait.
              // The sweep was cued for a landing that is not coming yet; it
              // waits for the unveil, and the wait itself is silent
              sweep?.stop(0);
              sweep = null;
              held = true;
              break;
            case 'unveil': {
              // Any swish still queued belongs to a turn that is over
              stopAll(swishes, 40);
              if (held) {
                // The landing is an unveil and a beam away: the sweep starts
                // now, its lead cut to what is left
                held = false;
                const unveilMs = event.durationMs || timeline.unveilMs || DEFAULT_UNVEIL_MS;
                const beamMs = timeline.beamMs ?? DEFAULT_BEAM_MS;
                sweep = engine.play('reveal-sweep', {
                  gain: 1,
                  delayMs: Math.max(0, unveilMs + beamMs - SWEEP_LEAD_MS),
                });
              }
              // Started here, the impact's rise runs through the beam and hits on the landing
              const unveilMs = event.durationMs || timeline.unveilMs || DEFAULT_UNVEIL_MS;
              const beamMs = timeline.beamMs ?? DEFAULT_BEAM_MS;
              keep(
                landing,
                engine.play('impact', {
                  gain: IMPACT_GAIN[tier()],
                  delayMs: Math.max(0, unveilMs + beamMs - IMPACT_RISE_MS),
                }),
              );
              break;
            }
            case 'beam': {
              const beamMs = event.durationMs || DEFAULT_BEAM_MS;
              keep(landing, engine.play('magic', {gain: 1, delayMs: beamMs}));
              break;
            }
            case 'retract':
              stopTear(150);
              break;
            default:
              break;
          }
          break;
        case 'revealed':
          // The landing's tails may ring on; nothing else runs past the ceremony
          stopTear(60);
          stopAll(swishes, 40);
          break;
        case 'reset':
          stopEverything(40);
          break;
        default:
          break;
      }
    },
    dispose() {
      stopEverything(60);
    },
  };

  function stopEverything(fadeMs: number) {
    stopTear(fadeMs);
    stopAll(swishes, fadeMs);
    sweep?.stop(fadeMs);
    sweep = null;
    stopAll(landing, fadeMs);
  }
}

/**
 * The burst score, as sparse. A low engine builds under the finger; the blast
 * is a produced whoosh-and-impact with the sub boom under it; then the same
 * reveal as the pieces gather — the sweep, the impact rising to hit as the
 * card settles, the magic on it — with the card set down as the last piece
 * snaps in. Nothing loops after the blast.
 *
 * The charge is a clock: the pack blows a fixed hold after the touch unless
 * it is let go. So the blast file, which whooshes before it hits, is cued
 * from the touch to hit on the flash frame, and cancelled on a release. The
 * scene's `release` phase is not the blast: it is a pack let go too early,
 * its pressure bleeding back out — the engine winds down with it. The blast
 * itself is `opened`, the frame the pack stops existing inside the flash.
 */
function burstScore(engine: SoundEngine, tier: () => LandingTier): Score {
  let timeline: SceneTimeline = {};
  let charge: Voice | null = null;
  let blast: Voice | null = null;
  let blastHoldMs = 0;
  let sweep: Voice | null = null;
  // When the swarm the sweep was cued from was due to end
  let sweepAt = 0;
  const landing: Voice[] = [];

  const startCharge = () => {
    charge?.stop(60);
    charge = engine.play('engine-low', {loop: true, gain: 0.2, rate: 0.8, fadeInMs: 120});
  };
  const stopCharge = (fadeMs: number) => {
    charge?.stop(fadeMs);
    charge = null;
  };
  // Cued to hit on the flash a hold away; a hold the same as the one already
  // cued for (the RIP! path announces the touch, then its hold) is left alone
  const cueBlast = (holdMs: number) => {
    if (blast && blastHoldMs === holdMs) return;
    blast?.stop(0);
    blast = engine.play('blast', {gain: 1, delayMs: Math.max(0, holdMs - BLAST_RISE_MS)});
    blastHoldMs = holdMs;
  };
  const cancelBlast = () => {
    blast?.stop(0);
    blast = null;
  };

  return {
    onEvent(event) {
      switch (event.type) {
        case 'timeline':
          timeline = event.timeline;
          break;
        case 'interactionStart':
          startCharge();
          cueBlast(timeline.chargeHoldMs ?? DEFAULT_HOLD_MS);
          break;
        case 'tick':
          charge?.setGain(0.2 + 0.8 * event.progress, 100);
          charge?.setRate(0.8 + 0.5 * event.progress, 100);
          break;
        case 'cancel':
          stopCharge(250);
          cancelBlast();
          break;
        case 'opened':
          stopCharge(30);
          // The blast is already whooshing in; if nothing was cued, it goes now
          if (!blast) blast = engine.play('blast', {gain: 1});
          engine.play('boom', {gain: 0.5});
          break;
        case 'phase':
          switch (event.name) {
            case 'autoCharge': {
              // No finger to follow: the engine climbs on its own over the hold.
              // The RIP! path announces the touch first, so it may already run;
              // the hold it announces is the one the blast is cued to
              if (!charge) startCharge();
              const holdMs = event.durationMs || timeline.chargeHoldMs || DEFAULT_HOLD_MS;
              charge?.setGain(1, holdMs);
              charge?.setRate(1.3, holdMs);
              cueBlast(holdMs);
              break;
            }
            case 'release': {
              // Let go too early: the pressure bleeds out, the engine with it
              const bleedMs = event.durationMs || timeline.releaseMs || 260;
              charge?.setRate(0.6, bleedMs);
              stopCharge(bleedMs);
              cancelBlast();
              break;
            }
            case 'swarm': {
              // The card settles a swarm, an assembly and a snap from here —
              // unless the artwork is late and the cloud turns on (the scene
              // then announces no further swarms): the sweep cued here would
              // peak before a landing that is not coming, so the assembly,
              // which only starts once the artwork is in, re-cues it
              const swarmMs = event.durationMs || DEFAULT_SWARM_MS;
              const assembleMs = timeline.assembleMs ?? DEFAULT_ASSEMBLE_MS;
              const snapMs = timeline.snapMs ?? DEFAULT_SNAP_MS;
              sweep?.stop(0);
              sweep = engine.play(own(engine, 'burst-sweep', 'reveal-sweep'), {
                gain: 0.8,
                delayMs: Math.max(0, swarmMs + assembleMs + snapMs - SWEEP_LEAD_MS),
              });
              sweepAt = performance.now() + swarmMs;
              break;
            }
            case 'assemble': {
              const assembleMs = event.durationMs || timeline.assembleMs || DEFAULT_ASSEMBLE_MS;
              const snapMs = timeline.snapMs ?? DEFAULT_SNAP_MS;
              // The swarm ran long (late artwork): the sweep it cued is off
              // the landing by however much — cue it afresh from here
              if (performance.now() > sweepAt + 100) {
                sweep?.stop(0);
                sweep = engine.play(own(engine, 'burst-sweep', 'reveal-sweep'), {
                  gain: 0.8,
                  delayMs: Math.max(0, assembleMs + snapMs - SWEEP_LEAD_MS),
                });
              }
              keep(
                landing,
                engine.play(own(engine, 'burst-impact', 'impact'), {
                  gain: IMPACT_GAIN[tier()],
                  delayMs: Math.max(0, assembleMs + snapMs - IMPACT_RISE_MS),
                }),
              );
              break;
            }
            case 'snap':
              engine.play('card-place', {gain: 0.7});
              break;
            case 'settle':
              keep(landing, engine.play(own(engine, 'burst-magic', 'magic'), {gain: 1}));
              break;
            default:
              break;
          }
          break;
        case 'revealed':
          stopCharge(60);
          break;
        case 'reset':
          stopEverything(40);
          break;
        default:
          break;
      }
    },
    dispose() {
      stopEverything(60);
    },
  };

  function stopEverything(fadeMs: number) {
    stopCharge(fadeMs);
    cancelBlast();
    sweep?.stop(fadeMs);
    sweep = null;
    stopAll(landing, fadeMs);
  }
}

/**
 * The carousel score is the reference's own: the ring clicks as it turns
 * past a copy — under the finger, on a shuffle, settling — over a low
 * ambience while the copies wait; the tap that chooses one has its select,
 * a four-second swell that carries the pack up and shimmers into the float,
 * which is otherwise silent for as long as it lasts. Then a whoosh under
 * each fact as it appears, the banner sliding in on one more, and the chime
 * as the card flips over. Nothing loops past the ring: the ambience goes
 * with the chosen copy's neighbours.
 *
 * The ambience is a cue the host supplies a file for (`carousel-bg`);
 * without it the ring waits in silence. Without the select the tap is a
 * card set down and the rise its own whoosh.
 */
function carouselScore(engine: SoundEngine): Score {
  let timeline: SceneTimeline = {};
  let ambience: Voice | null = null;
  // The select sounded for this choice: the rise rides on it
  let selected = false;
  const chimes: Voice[] = [];

  const startAmbience = () => {
    if (ambience || !engine.has('carousel-bg')) return;
    ambience = engine.play('carousel-bg', {loop: true, gain: 0.3, fadeInMs: 600});
  };
  const stopAmbience = (fadeMs: number) => {
    ambience?.stop(fadeMs);
    ambience = null;
  };

  return {
    onEvent(event) {
      switch (event.type) {
        case 'timeline':
          timeline = event.timeline;
          // The ring is up: its ambience with it
          startAmbience();
          break;
        case 'phase':
          switch (event.name) {
            case 'step':
              engine.play('ring-step', {gain: 0.7});
              break;
            case 'drop':
              // The choice: the select carries the rise too; without it a
              // card set down, and the rise gets its whoosh
              selected = !!engine.play('pack-select', {gain: 1});
              if (!selected) engine.play('card-place', {gain: 0.6});
              stopAmbience(500);
              break;
            case 'rise':
              if (!selected) engine.play('ring-whoosh', {gain: 0.9});
              break;
            case 'facts': {
              // A whoosh as each fact comes in; the last one is the pill
              const factMs = timeline.factMs ?? DEFAULT_FACT_MS;
              const step = factMs + (timeline.factGapMs ?? DEFAULT_FACT_GAP_MS);
              const beats = Math.max(1, Math.round((event.durationMs || step) / step));
              stopAll(chimes, 40);
              for (let i = 0; i < beats; i++) {
                keep(
                  chimes,
                  engine.play('ring-whoosh', {gain: 0.7, delayMs: Math.round(i * step)}),
                );
              }
              break;
            }
            case 'banner':
              engine.play('ring-whoosh', {gain: 0.7});
              break;
            case 'flip':
              engine.play('chime', {gain: 1});
              break;
            default:
              break;
          }
          break;
        case 'revealed':
          stopAll(chimes, 40);
          break;
        case 'reset':
          selected = false;
          stopEverything(40);
          break;
        default:
          break;
      }
    },
    dispose() {
      stopEverything(60);
    },
  };

  function stopEverything(fadeMs: number) {
    stopAmbience(fadeMs);
    stopAll(chimes, fadeMs);
  }
}

/** A semitone step as a playback rate. */
const semis = (n: number) => Math.pow(2, n / 12);
/** The major pentatonic the musical design climbs, in semitones. */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
/** The kalimba's note sits 11.83 semitones under C5: every note is brought up to the scale's C first. */
const NOTE_TUNE = semis(11.83);
/** How long the ratchet waits between ticks at 1×, in ms. */
const RATCHET_MS = 125;
/** How long after the hits' boom their rays' shimmer comes in, in ms. */
const SHIMMER_AFTER_MS = 150;
/** How far apart in pitch a pop sounds from one tier to the next, and how much fuller. */
const POP_STEP = 0.07;

/**
 * The climb score, in one of three designs the operator picks (`sound.design`, chosen by ear on the second
 * stand, 20.11.2026):
 *
 * - `impact` — a pause, then the blow: a deep pulse while the packs spin, closer and louder towards the stop
 *   (the scene tells it, so Speed up hurries it), a riser ending on the stop, one lock cascade for every stop,
 *   a glass pop for each pack bursting, deeper and fuller the higher its tier, the hits trembling on a drum roll
 *   and landing on a sub boom under the flash, a shimmer for their rays, a drum for every beat of the combo.
 * - `arcade` — the machine: a ratchet the whole reel (quicker on Speed up), a clack for every stop, bright pops,
 *   a boom and a fanfare on the hits, a shower of coins for a sale.
 * - `music` — every moment a note of one chord on a kalimba: the stops climb a pentatonic, each card sounds its
 *   tier, the hits a chord under a hall boom, the combo climbs, the coins land on the top note.
 *
 * All three: a deep whoosh as the items fly in, the prices' rush into the total, a rubber stamp for a card sold,
 * the coins (`cue` `coins`) and their landing in the balance (`cue` `ding`, the host's), a whoosh for a Speed up,
 * the cards on show whisked away. Whatever the host skipped past is not replayed: events marked `skipped` are
 * silent. A cue the bank lacks falls back to one of the score's older sounds.
 */
function climbScore(engine: SoundEngine, design: () => SoundDesign): Score {
  const voices: Voice[] = [];
  // This ceremony: whether it has taken off, how many items have come to rest
  let tookOff = false;
  let rests = 0;
  // The machine's ratchet: its timer, and the pace it ticks at
  let ratchet: ReturnType<typeof setTimeout> | null = null;
  let pace = 1;

  const play = (cue: string, fallback: string, options: PlayOptions = {}) =>
    keep(voices, engine.play(own(engine, cue, fallback), options));
  const note = (semitones: number, gain: number, delayMs = 0) =>
    play('climb-note', 'chime', {rate: NOTE_TUNE * semis(semitones), gain, delayMs});
  const stopRatchet = () => {
    if (ratchet !== null) clearTimeout(ratchet);
    ratchet = null;
  };
  const tick = () => {
    play('climb-ratchet', 'ring-step', {gain: 0.7, rate: 1 + (Math.random() * 2 - 1) * 0.025});
    ratchet = setTimeout(tick, RATCHET_MS / pace);
  };
  const stopEverything = (fadeMs: number) => {
    stopRatchet();
    stopAll(voices, fadeMs);
  };
  const begin = () => {
    tookOff = false;
    rests = 0;
    pace = 1;
  };

  const phase = (name: string) => {
    const mode = design();
    switch (name) {
      case 'intro':
        stopEverything(40);
        begin();
        keep(voices, engine.play('whoosh-deep', {gain: mode === 'impact' ? 1.5 : 1}));
        break;
      case 'reel':
        if (mode === 'arcade' && ratchet === null) ratchet = setTimeout(tick, RATCHET_MS / 2);
        break;
      case 'settle':
        stopRatchet();
        if (mode === 'impact') play('climb-cascade', 'ring-step');
        break;
      case 'gather':
        play('climb-gather', 'swish');
        break;
      case 'done':
        stopRatchet();
        break;
      default:
        break;
    }
  };

  const cue = (name: string, index: number, value: number) => {
    const mode = design();
    switch (name) {
      case 'takeoff':
        if (mode === 'impact' && !tookOff) play('climb-takeoff', 'swish');
        tookOff = true;
        break;
      case 'pulse':
        if (mode === 'arcade') break;
        // Louder towards the stop
        play('climb-pulse', 'sub-hit', {gain: 1.5 * (mode === 'music' ? 0.6 : 0.8 + 0.25 * clamp01(value))});
        break;
      case 'riser':
        // Told `value` ms ahead of the stop: started its own length before it, so it ends on it
        if (mode === 'impact') play('climb-riser', 'whoosh-deep', {gain: 1.5, delayMs: Math.max(0, value - engine.duration('climb-riser'))});
        break;
      case 'burst': {
        const rank = Math.max(0, value);
        if (mode === 'music') {
          note(PENTA[Math.min(PENTA.length - 1, rank + 2)] - 5, 0.85);
        } else {
          const jitter = 1 + (Math.random() * 2 - 1) * 0.025;
          const rate = (mode === 'arcade' ? 0.95 + POP_STEP * rank : 1.1 - POP_STEP * rank) * jitter;
          play('climb-pop', 'swish', {rate, gain: 0.62 * (0.8 + POP_STEP * rank)});
        }
        break;
      }
      case 'rattle':
        if (mode === 'impact') play('climb-rattle', 'engine-low', {gain: 1.5});
        break;
      case 'beat':
        if (mode === 'music') note(12 + PENTA[Math.max(0, index) % 5], 0.8);
        else play('climb-beat', 'impact', {rate: semis(2 * Math.max(0, index))});
        break;
      case 'stamp':
        play('climb-stamp', 'card-place');
        break;
      case 'coins':
        if (mode === 'arcade') play('climb-shower', 'chime');
        else play('climb-coins', 'chime');
        break;
      case 'ding':
        if (mode === 'impact') {
          play('climb-ding-silver', 'chime', {gain: 1.5});
        } else {
          play('climb-ding-desk', 'chime');
          if (mode === 'music') note(24, 0.6);
        }
        break;
      case 'speed':
        if (value > 0) pace = value;
        // The arcade's ratchet takes the new pace from its next tick
        play('climb-speed', 'swish');
        break;
      case 'leave':
        play('climb-leave', 'swish');
        break;
      default:
        break;
    }
  };

  return {
    onEvent(event) {
      switch (event.type) {
        case 'phase':
          phase(event.name);
          break;
        case 'cue':
          cue(event.name, event.index, event.value ?? 0);
          break;
        case 'cardSettled': {
          if (event.skipped) break;
          const mode = design();
          if (mode === 'arcade') play('climb-clack', 'ring-step', {rate: 1 + 0.03 * rests});
          else if (mode === 'music') note(PENTA[rests % PENTA.length] - 12, 0.7);
          rests++;
          break;
        }
        case 'hitsRevealed': {
          if (event.skipped) break;
          const mode = design();
          if (mode === 'impact') {
            play('climb-boom-sub', 'impact', {gain: 1.5});
            keep(voices, engine.play('magic', {delayMs: SHIMMER_AFTER_MS}));
          } else if (mode === 'arcade') {
            play('climb-boom-hall', 'impact');
            play('climb-fanfare', 'magic', {delayMs: 120});
          } else {
            play('climb-boom-hall', 'impact');
            for (const step of [0, 4, 7, 12]) note(step, 0.6, 20);
            play('climb-shimmer', 'magic', {delayMs: SHIMMER_AFTER_MS});
          }
          break;
        }
        case 'reset':
          stopEverything(40);
          begin();
          break;
        default:
          break;
      }
    },
    dispose() {
      stopEverything(60);
    },
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function createScore(
  engine: SoundEngine,
  variant: VariantName,
  tier: () => LandingTier,
  design: () => SoundDesign = () => 'impact',
): Score {
  if (variant === 'carousel') return carouselScore(engine);
  if (variant === 'climb') return climbScore(engine, design);
  return variant === 'burst' ? burstScore(engine, tier) : sliceScore(engine, tier);
}
