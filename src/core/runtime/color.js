/**
 * Colours come in from the host as CSS strings, but Pixi wants numbers and the
 * canvas gradients want `rgba()` — this is the one place that converts between
 * the three, so a theme can be written in whatever form reads best.
 */

const clamp255 = value => Math.max(0, Math.min(255, Math.round(value)));

/** `#rgb` / `#rrggbb` / `rgb(...)` / `rgba(...)` → channels, or null. */
export function parseColor(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const digits = hex[1];
    const full =
      digits.length === 3
        ? digits
            .split('')
            .map(c => c + c)
            .join('')
        : digits;
    const n = parseInt(full, 16);
    return {r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1};
  }

  const rgb = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (rgb) {
    const parts = rgb[1].split(',').map(p => parseFloat(p));
    if (parts.length < 3 || parts.some(p => Number.isNaN(p))) {
      return null;
    }
    return {
      r: clamp255(parts[0]),
      g: clamp255(parts[1]),
      b: clamp255(parts[2]),
      a: parts.length > 3 ? Math.max(0, Math.min(1, parts[3])) : 1,
    };
  }

  return null;
}

/** For Pixi's numeric colours. Falls back to the given number on garbage input. */
export function toNumber(value, fallback = 0xffffff) {
  const c = parseColor(value);
  return c ? (c.r << 16) | (c.g << 8) | c.b : fallback;
}

/** Same colour at a different opacity — how gradient stops are built. */
export function withAlpha(value, alpha) {
  const c = parseColor(value) || {r: 255, g: 255, b: 255, a: 1};
  return `rgba(${c.r},${c.g},${c.b},${Math.max(0, Math.min(1, alpha))})`;
}

/** Alpha the host wrote into the colour itself, e.g. a sheen at 0.85. */
export function alphaOf(value, fallback = 1) {
  const c = parseColor(value);
  return c ? c.a : fallback;
}
