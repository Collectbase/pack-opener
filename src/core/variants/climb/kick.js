/**
 * The stage taking a hit: thrown off its centre and shaken back in a run of
 * poses, each held a moment — to one side, to the other, less every time.
 * Held, not glided through: on a 60 fps screen a pose stands for two frames,
 * on a 30 fps one for one, and no frame in between shows the stage at rest —
 * a glide through the same extremes reads half as hard. What moves is the
 * cards and what they throw off; what is written — a price, the combo — and
 * the host's page stay where they are, so a card is seen to slide under its
 * own price. Pure numbers, in css px and ms.
 */

/** How long each pose of a shake is held, in ms: one frame of a 30 fps screen. */
export const KICK_STEP_MS = 1000 / 30;
/**
 * A pose is read this far into its step. A shake starts on a frame and is
 * moved on by whole frames, so without it every change of pose would fall
 * exactly on a frame's time and the rounding of a timestamp would decide
 * which pose a frame draws: at 30 fps a fifth of them were never drawn.
 */
const KICK_LEAD_MS = KICK_STEP_MS / 8;

/** The pose a shake `elapsed` ms old stands in, counted from its first. */
const stepAt = elapsed => Math.floor((elapsed + KICK_LEAD_MS) / KICK_STEP_MS);

/**
 * The shakes: where the stage stands, off its centre, pose after pose, in
 * css px on a stage 390 wide. Each is hardest on its first pose and thrown
 * to the left there; the sideways ones are a card landing, the diagonal ones
 * a blow from the hits.
 */
export const KICKS = {
  /** The first card of a grid lands on its face. */
  land: [
    [-8.6, 1.2],
    [4.9, -1.1],
    [-2.6, 0.8],
    [2.7, 0],
    [-0.4, -0.5],
    [-1.6, 0.6],
    [1.7, -0.6],
    [-0.3, -0.1],
  ],
  /** A card alone lands on its face: two blows, the second as its light bursts. */
  lone: [
    [-5.5, -2.8],
    [4.7, 2.2],
    [-3.2, -2.0],
    [-0.5, -0.5],
    [-4.0, -1.0],
    [1.8, 0.3],
    [-0.5, -0.2],
  ],
  /** The hits come round under the flash: the hardest, and still hard as the flash fades. */
  hits: [
    [-11.0, -7.3],
    [8.2, 7.1],
    [-5.8, -5.6],
    [8.8, 4.0],
    [-9.4, -2.0],
    [4.7, 1.8],
    [-0.7, -1.1],
    [0.4, 0.4],
  ],
  /** One beat of the combo: one hit counted. */
  combo: [
    [-3.1, -2.2],
    [1.9, 1.6],
    [-1.0, -1.0],
    [0.6, 0.3],
  ],
  /** A sum reaches the balance, on the host's word. */
  credit: [
    [-4.0, 1.4],
    [2.0, -0.2],
    [-0.7, 0.2],
    [0.7, 0.2],
  ],
  /** The same under a card alone: smaller, and more up than sideways. */
  creditLone: [
    [-1.2, -1.9],
    [1.6, 1.1],
    [-0.8, -0.9],
    [0.7, 0.3],
  ],
  /** The pack comes down in the middle of the stage and bursts into the grid. */
  start: [
    [-6.2, 0],
    [2.7, 0],
    [-1.6, 0],
    [1.1, 0],
  ],
  /** A pack alone starts to spin. */
  spin: [
    [-4.6, 0],
    [2.3, 0],
    [-1.2, 0],
    [0.6, 0],
  ],
};

const AT_REST = {x: 0, y: 0};

const reachOf = pose => Math.hypot(pose[0], pose[1]);

/** How far the hardest pose of `poses` from `from` on throws the stage, in px. */
export function peakOf(poses, from = 0) {
  let peak = 0;
  for (let i = Math.max(0, from); i < (poses?.length ?? 0); i++) peak = Math.max(peak, reachOf(poses[i]));
  return peak;
}

/** Where `poses`, `gain` times as hard, have the stage `elapsed` ms in: the pose of that moment, at rest after the last. */
export function kickPose(poses, elapsed, gain = 1) {
  if (!poses?.length || !(gain > 0) || !(elapsed >= 0)) return AT_REST;
  const pose = poses[stepAt(elapsed)];
  return pose ? {x: pose[0] * gain, y: pose[1] * gain} : AT_REST;
}

/**
 * The shake the stage is taking now. A new one replaces it only when it is
 * at least as hard as what the one under way still has to come.
 */
export class StageKick {
  constructor() {
    this.poses = null;
    this.gain = 0;
    this.elapsed = 0;
    // Struck and not yet drawn: the frame it is struck on does not eat into its first pose
    this.struck = false;
  }

  /** Still shaking. */
  get live() {
    return this.left > 0;
  }

  /** How long the shake under way still lasts, in ms. */
  get left() {
    return this.poses ? Math.max(0, this.poses.length * KICK_STEP_MS - KICK_LEAD_MS - this.elapsed) : 0;
  }

  /** How hard the shake under way still gets, in px. */
  get reach() {
    return this.live ? peakOf(this.poses, stepAt(this.elapsed)) * this.gain : 0;
  }

  /** `poses`, `gain` times as hard; a weaker blow than what is left of the last is passed over. */
  strike(poses, gain = 1) {
    if (!poses?.length || !(gain > 0) || peakOf(poses) * gain < this.reach) return;
    this.poses = poses;
    this.gain = gain;
    this.elapsed = 0;
    this.struck = true;
  }

  /** `deltaMS` of the wall clock on: a shake lasts what it lasts, however the ceremony is hurried. */
  update(deltaMS) {
    if (this.struck) {
      this.struck = false;
      return;
    }
    if (this.live) this.elapsed += deltaMS;
  }

  /** Where the stage stands now, off its centre. */
  offset() {
    return this.live ? kickPose(this.poses, this.elapsed, this.gain) : AT_REST;
  }

  clear() {
    this.poses = null;
    this.gain = 0;
    this.elapsed = 0;
    this.struck = false;
  }
}
