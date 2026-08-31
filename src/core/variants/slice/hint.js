/**
 * The nudge that tells the finger what to do: a soft comet sweeping across the
 * seal while the pack is untouched. It owns its own graphics and its own clock —
 * the scene only says whether the pack has been touched yet.
 */
import {Graphics} from 'pixi.js';
import {clamp, easeInOut} from './geometry';

/**
 * Mimes the swipe: a soft white comet that sweeps across the top of the pack.
 * Built from overlapping discs rather than a stroked line — the taper reads
 * smoother, and it is one fill batch. `head` is its position over the sweep.
 */
function drawHint(g, rect, head, hint, color) {
  g.clear();

  // Eased in and out at the ends of the sweep, so nothing pops into view
  const presence = Math.sin(Math.PI * clamp(head, 0, 1));
  if (presence <= 0.01) {
    return;
  }

  const y = rect.top + rect.height * hint.lineRatio;
  const span = rect.width * hint.sweep;
  const from = rect.left + (rect.width - span) / 2;
  const x = from + span * head;
  const tail = rect.width * hint.tail;

  for (let i = 0; i < hint.segments; i++) {
    // 0 at the far end of the tail, 1 at the head
    const t = (i + 1) / hint.segments;
    const px = x - tail * (1 - t);
    if (px < from) {
      continue;
    }
    g.circle(px, y, hint.headRadius * t).fill({
      color,
      alpha: hint.tailAlpha * Math.pow(t, hint.tailFalloff) * presence,
    });
  }

  g.circle(x, y, hint.headRadius).fill({color, alpha: presence});
}

export class SliceHint {
  constructor(color) {
    this.view = new Graphics();
    this.color = color;
    this.alpha = 1;
    this.clock = 0;
  }

  setColor(color) {
    this.color = color;
  }

  /** `hidden` is the moment the pack is touched — the comet fades out for good. */
  update(deltaMS, rect, options, hidden) {
    const wanted = hidden ? 0 : 1;
    if (this.alpha !== wanted) {
      const step = deltaMS / options.fadeMs;
      this.alpha = clamp(
        wanted > this.alpha ? this.alpha + step : this.alpha - step,
        0,
        1,
      );
    }

    this.view.alpha = this.alpha;
    if (this.alpha <= 0) {
      return;
    }

    const cycle = options.loopMs + options.idleMs;
    this.clock = (this.clock + deltaMS) % cycle;
    const sweep = clamp(this.clock / options.loopMs, 0, 1);
    drawHint(this.view, rect, easeInOut(sweep), options, this.color);
  }
}
