/**
 * Draw order across elevation levels. Within a level, entities sort by the world y of their
 * feet (or footprint bottom). Each level then gets its own band of depths, so anything on a
 * higher level draws over everything on a lower one, which lets a bridge deck cover the
 * ground below it while the learner walking on the deck stays above it.
 *
 * Bands for level L (offsets from L * LEVEL_STRIDE):
 *   deck      -1000          an elevated surface such as a bridge, over lower levels
 *   entities  0 .. 4999      feet y (maps must stay under 5000 world units tall)
 *   overhead  5000           arch tops, awnings
 */
export const LEVEL_STRIDE = 10_000;
export const MAX_SORT_Y = 4_999;

/** Flat ground and decoration, below every entity on every level. */
export const GROUND_DEPTH = -10_000;

export function entityDepth(level: number, y: number): number {
  return level * LEVEL_STRIDE + Math.min(y, MAX_SORT_Y);
}

export function deckDepth(level: number): number {
  return level * LEVEL_STRIDE - 1_000;
}

export function overheadDepth(level: number): number {
  return level * LEVEL_STRIDE + 5_000;
}
