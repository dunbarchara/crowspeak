import { describe, expect, it } from 'vitest';
import { buildLevelWorld } from './levels';
import { findLevelPath } from './pathfinding';

// Same layout as levels.test.ts: level 1 on top, level 0 below, one stair in between.
const world = buildLevelWorld(
  6,
  4,
  10,
  { x: 0, y: 0 },
  [
    { level: 0, rect: { x: 0, y: 20, w: 60, h: 20 } },
    { level: 1, rect: { x: 0, y: 0, w: 60, h: 20 } },
  ],
  [],
  [
    {
      id: 's',
      rect: { x: 20, y: 10, w: 20, h: 20 },
      low: 0,
      high: 1,
      highEdge: 'n',
    },
  ],
);

describe('findLevelPath', () => {
  it('walks up the stair to reach the other level', () => {
    const path = findLevelPath(
      world,
      { level: 0, col: 0, row: 3 },
      { level: 1, col: 0, row: 0 },
    );
    expect(path).not.toBeNull();
    const cells = path!;
    expect(cells.at(-1)).toEqual({ level: 1, col: 0, row: 0 });
    // Every step onto the other level happens inside the stair columns (2 and 3).
    const change = cells.findIndex((c) => c.level === 1);
    expect(cells[change].col === 2 || cells[change].col === 3).toBe(true);
    // The level never goes back and forth.
    expect(cells.map((c) => c.level)).toEqual(
      [...cells.map((c) => c.level)].sort(),
    );
  });

  it('works downhill too', () => {
    const path = findLevelPath(
      world,
      { level: 1, col: 5, row: 0 },
      { level: 0, col: 5, row: 3 },
    );
    expect(path?.at(-1)).toEqual({ level: 0, col: 5, row: 3 });
  });

  it('stays on one level when the goal is on the same level', () => {
    const path = findLevelPath(
      world,
      { level: 0, col: 0, row: 3 },
      { level: 0, col: 5, row: 3 },
    );
    expect(path?.every((c) => c.level === 0)).toBe(true);
  });

  it('returns null when a level has no stair', () => {
    const noStairs = buildLevelWorld(
      6,
      4,
      10,
      { x: 0, y: 0 },
      [
        { level: 0, rect: { x: 0, y: 20, w: 60, h: 20 } },
        { level: 1, rect: { x: 0, y: 0, w: 60, h: 20 } },
      ],
      [],
      [],
    );
    expect(
      findLevelPath(
        noStairs,
        { level: 0, col: 0, row: 3 },
        { level: 1, col: 0, row: 0 },
      ),
    ).toBeNull();
  });

  it('returns an empty path at the goal and null for blocked cells', () => {
    const here = { level: 0, col: 1, row: 3 };
    expect(findLevelPath(world, here, here)).toEqual([]);
    expect(findLevelPath(world, here, { level: 0, col: 1, row: 0 })).toBeNull();
  });
});
