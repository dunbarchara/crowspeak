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
