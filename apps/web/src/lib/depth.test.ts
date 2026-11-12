import { describe, expect, it } from 'vitest';
import { GROUND_DEPTH, deckDepth, entityDepth, overheadDepth } from './depth';

describe('depth bands', () => {
  it('sorts entities on one level by y', () => {
    expect(entityDepth(0, 100)).toBeLessThan(entityDepth(0, 200));
  });

  it('draws a deck over the level below and under the level it carries', () => {
    expect(entityDepth(0, 4_000)).toBeLessThan(deckDepth(1));
    expect(overheadDepth(0)).toBeLessThan(deckDepth(1));
    expect(deckDepth(1)).toBeLessThan(entityDepth(1, 0));
  });

  it('keeps overhead above every entity on its level', () => {
    expect(entityDepth(1, 99_999)).toBeLessThan(overheadDepth(1));
  });

  it('keeps flat ground below everything', () => {
    expect(GROUND_DEPTH).toBeLessThan(entityDepth(0, 0));
  });
});
