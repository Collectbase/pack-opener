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
   * burst: autoCharge, release, beat, swarm, assemble, snap, settle;
   * climb: intro — the items fly in; reel — they spin until the cards are
   * in, for at least `durationMs`; settle — they stop one by one; turn — the
   * ordinary cards turn over; hits — the hits wait, then turn together;
   * combo — the combo is written under the grid, when there is one; done —
   * every card is up, `durationMs` 0; its lengths are at the pace `setSpeed`
   * set when each began, and a ceremony skipped to its end announces only
   * done) and
   * `durationMs` how long it will run. For a host that scores the ceremony —
   * a sound on the lid coming off, a rising tone under the charge, a swish on
   * the turn — where `opened` and `revealed` are too coarse.
   *
   * Slice also announces 0.4's names beside its own, for hosts scored by
   * them: `spin` with `open`, `unveil` with `charge` (or once late artwork
   * arrives), `spinHold` with `chargeHold`, `beam` with `flip`. The card
   * lands as `beam` ends, as it did in 0.4. Deprecated, kept for now (to be
   * removed in a later release).
   */
  PHASE: 'phase',
  /**
   * How long each phase of the ceremony will run, in ms, after `motion.speed`
   * — for slice `chargeMs`, `flipMs`, `landMs`, `holdMs` (and, deprecated,
   * 0.4's `spinMs`, `unveilMs`, `beamMs`); for burst
   * `chargeHoldMs`, `releaseMs`, `beatMs`, `swarmMs`, `assembleMs`,
   * `snapMs`; for carousel `shuffleMs`, `dropMs`, `riseMs`, `dissolveMs`,
   * `factMs`, `factGapMs`, `bannerMs`, `bannerHoldMs`, `flipMs`; for climb
   * `introMs`, `spinMs` (one turn of its items), `reelMinMs`,
   * `stopStaggerMs`, `flipStaggerMs`, `hitHoldMs`, `rollUpMs` — before
   * `setSpeed`, which hurries them without a new timeline. Posted with
   * `ready` and again after every retune, so a host that cues a sound ahead
   * of a phase (an impact that has to land as the card does) can count from
   * the real numbers. Web only: the scene bundle does not post it.
   */
  TIMELINE: 'timeline',
  /** The stage changed size — a rotated phone, a resized window — and the pack
   * was re-derived for the new box; `rect` is where it is now. */
  LAYOUT: 'layout',
  /**
   * `climb`: item `index` has come to rest on its card's colour — told in
   * grid order. `colorIndex` is where that colour stands in
   * `climb.cycleColors`, lowest first (-1 for one outside it), for a sound
   * that rises with the tier. Like `cardRevealed` and `hitsRevealed`, it
   * carries `skipped: true` when `skipToEnd()` told it at once, with the rest.
   */
  CARD_SETTLED: 'cardSettled',
  /** `climb`: card `index` has turned face up; `card` is where it is on the stage. */
  CARD_REVEALED: 'cardRevealed',
  /** `climb`: the hits have come round together, under the flash; each is `cardRevealed` once still. */
  HITS_REVEALED: 'hitsRevealed',
  /**
   * `climb`: every card is up with its price counted; `cards` are where they
   * are, in grid order — none after `setCards([])`, which ends the ceremony
   * at once on an empty grid. Once per ceremony, skipped or not, whatever
   * the host calls from inside its events. A ceremony the host replaces
   * (`start()`) or resets before this — even on hearing its `done` — says
   * nothing more, this included.
   */
  ALL_REVEALED: 'allRevealed',
  /**
   * `climb`: card `index` was tapped, once every card was up. A press the
   * browser took away (`pointercancel`) or that wandered off is no tap.
   */
  CARD_TAP: 'cardTap',
  /**
   * `climb`: a moment of the ceremony a sound may mark, by `name`, with an
   * `index` and, for some, a `value`: `takeoff` (item `index` takes off into
   * its spin); `pulse` (every so often while the reel spins, closer as the
   * stop nears — `value` how far through the reel, 0..1); `riser` (the stop
   * foreseen — `value` the ms left before it); `burst` (card `index` comes
   * up — `value` where its colour stands in `climb.cycleColors`); `rattle`
   * (the hits begin to tremble); `beat` (beat `index` of the combo);
   * `stamp` (cards stamped SOLD this frame); `speed` (Speed up — `value` the
   * new pace); `leave` (the cards on show whisked away as the next ceremony
   * begins); or one the host names with `cue(name)` (`coins` as a sale's
   * coins set off, `ding` as they land in the balance).
   */
  CUE: 'cue',
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
