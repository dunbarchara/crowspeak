/** A custom property's value in pixels, or `fallback` if it is missing or not in px. */
export function readPx(
  element: Element,
  name: string,
  fallback: number,
): number {
  const raw = getComputedStyle(element).getPropertyValue(name).trim();
  const value = raw.endsWith('px') ? parseFloat(raw) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

/** A custom property holding `#rrggbb` (or `#rgb`), as a Phaser color number, or `fallback`. */
export function readColor(
  element: Element,
  name: string,
  fallback: number,
): number {
  const raw = getComputedStyle(element).getPropertyValue(name).trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (!match) return fallback;
  const hex = match[1];
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return parseInt(full, 16);
}
