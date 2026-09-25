/**
 * Wire protocol between the scene and its host. The scene runs in a WebView on
 * React Native, so these strings cross a bridge — they are part of the public
 * contract and must stay in step with any host that speaks to the scene.
 */

/** Messages the scene posts out. */
export const MESSAGES = {
  READY: 'ready',
  INTERACTION_START: 'interactionStart',
  TICK: 'tick',
  COMMITTED: 'committed',
  OPENED: 'opened',
  /** Card reveal finished — the host may move on to its result screen. */
  REVEALED: 'revealed',
  RETRACTED: 'retracted',
  /**
   * The card has turned over and landed face up (`slice`) — the moment for
   * a heavy haptic or an impact sound. The React Native wrapper turns it into
   * `onHaptic('heavy')` by itself.
   */
  IMPACT: 'impact',
  /**
   * A phase of the ceremony has begun; `name` is the scene's own word for it
   * (slice: autoSlice, runOut, open, charge, chargeHold — the card held at
   * its peak while its artwork is still on its way, announced once for the
   * whole wait — flip, land, hold, retract;
   * burst: autoCharge, release, beat, swarm, assemble, snap, settle) and
   * `durationMs` how long it will run. For a host that scores the ceremony —
   * a sound on the lid coming off, a rising tone under the charge, a swish on
   * the turn — where `opened` and `revealed` are too coarse.
   */
  PHASE: 'phase',
  /**
   * How long each phase of the ceremony will run, in ms, after `motion.speed`
   * — for slice `chargeMs`, `flipMs`, `landMs`, `holdMs`; for burst
   * `chargeHoldMs`, `releaseMs`, `beatMs`, `swarmMs`, `assembleMs`,
   * `snapMs`. Posted with `ready` and again after every retune, so a host
   * that cues a sound ahead of a phase (an impact that has to land as the
   * card does) can count from the real numbers. Web only: the scene bundle
   * does not post it.
   */
  TIMELINE: 'timeline',
  /** The stage changed size — a rotated phone, a resized window — and the pack
   * was re-derived for the new box; `rect` is where it is now. */
  LAYOUT: 'layout',
  ERROR: 'error',
} as const;

/** Commands the host sends in. */
export const COMMANDS = {
  AUTO_SLICE: 'autoSlice',
  /** Mix the choice up — the carousel's ring spins on. */
  SHUFFLE: 'shuffle',
  RESET: 'reset',
  SET_ENABLED: 'setEnabled',
  /** Retune a running scene instead of reloading the page. */
  SET_OPTIONS: 'setOptions',
} as const;

export type MessageType = (typeof MESSAGES)[keyof typeof MESSAGES];
export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];
