import { describe, expect, it } from 'vitest';
import { isCellWalkable, isFootprintWalkable } from './grid';
import {
  type StairZone,
  buildLevelWorld,
  levelAtCell,
  resolveLevel,
} from './levels';

// 6 columns x 4 rows of 10px cells. Level 0 is the bottom two rows (y 20..40) and level 1
// the top two (y 0..20); a 20px-wide stair (x 20..40) spans y 10..30 with level 1 to the north.
const stair: StairZone = {
  id: 's',
  rect: { x: 20, y: 10, w: 20, h: 20 },
  low: 0,
  high: 1,
  highEdge: 'n',
};
const world = (footprints: Parameters<typeof buildLevelWorld>[5] = []) =>
  buildLevelWorld(
    6,
    4,
    10,
    { x: 0, y: 0 },
    [
      { level: 0, rect: { x: 0, y: 20, w: 60, h: 20 } },
      { level: 1, rect: { x: 0, y: 0, w: 60, h: 20 } },
    ],
    footprints,
    [stair],
  );

describe('buildLevelWorld', () => {
  it('makes one grid per level, walkable only inside that level region', () => {
    const { grids } = world();
    expect(grids).toHaveLength(2);
    expect(isCellWalkable(grids[0], 0, 3)).toBe(true);
    expect(isCellWalkable(grids[0], 0, 0)).toBe(false);
    expect(isCellWalkable(grids[1], 0, 0)).toBe(true);
    expect(isCellWalkable(grids[1], 0, 3)).toBe(false);
  });

  it('keeps footprints on their own level only', () => {
    const { grids } = world([
      { id: 'f', level: 0, rect: { x: 40, y: 30, w: 10, h: 10 } },
    ]);
    expect(isCellWalkable(grids[0], 4, 3)).toBe(false);
    expect(isCellWalkable(grids[1], 4, 3)).toBe(false); // outside its region anyway
    expect(isCellWalkable(grids[1], 4, 0)).toBe(true);
  });

  it('opens the stair zone on both of its levels, over a footprint', () => {
    const { grids } = world([
      { id: 'f', level: 0, rect: { x: 20, y: 20, w: 10, h: 10 } },
    ]);
    for (const level of [0, 1]) {
      expect(isCellWalkable(grids[level], 2, 1)).toBe(true);
      expect(isCellWalkable(grids[level], 3, 2)).toBe(true);
    }
    expect(isCellWalkable(grids[0], 2, 2)).toBe(true);
  });

  it('rejects a stair whose low level is not below its high level', () => {
    expect(() =>
      buildLevelWorld(
        2,
        2,
        10,
        { x: 0, y: 0 },
        [],
        [],
        [{ ...stair, low: 1, high: 1 }],
      ),
    ).toThrow(/below/);
  });

  it('lets a footprint-sized body walk the stair on either level', () => {
    const { grids } = world();
    const body = { halfW: 4, halfH: 2 };
    expect(isFootprintWalkable(grids[0], 30, 28, body)).toBe(true);
    expect(isFootprintWalkable(grids[1], 30, 12, body)).toBe(true);
    // The wall between the levels, away from the stair.
    expect(isFootprintWalkable(grids[0], 5, 19, body)).toBe(false);
  });
});

describe('resolveLevel', () => {
  it('keeps the level outside stair zones', () => {
    expect(resolveLevel([stair], 0, { x: 5, y: 35 })).toBe(0);
    expect(resolveLevel([stair], 1, { x: 5, y: 5 })).toBe(1);
  });

  it('follows the half of the stair, whichever level you came from', () => {
    expect(resolveLevel([stair], 0, { x: 30, y: 12 })).toBe(1);
    expect(resolveLevel([stair], 1, { x: 30, y: 28 })).toBe(0);
    expect(resolveLevel([stair], 0, { x: 30, y: 25 })).toBe(0);
  });

  it('ignores stairs that do not join the current level', () => {
    expect(resolveLevel([stair], 2, { x: 30, y: 12 })).toBe(2);
  });

  it('honours each high edge', () => {
    const rect = { x: 0, y: 0, w: 10, h: 10 };
    const at = (highEdge: StairZone['highEdge'], x: number, y: number) =>
      resolveLevel([{ ...stair, rect, highEdge }], 0, { x, y });
    expect(at('s', 5, 8)).toBe(1);
    expect(at('s', 5, 2)).toBe(0);
    expect(at('w', 2, 5)).toBe(1);
    expect(at('e', 8, 5)).toBe(1);
    expect(at('e', 2, 5)).toBe(0);
  });
});

describe('levelAtCell', () => {
  it('finds the single level that can stand on a cell', () => {
    const w = world();
    expect(levelAtCell(w, { col: 0, row: 0 }, 0)).toBe(1);
    expect(levelAtCell(w, { col: 0, row: 3 }, 1)).toBe(0);
  });

  it('uses the stair half for cells inside a stair', () => {
    const w = world();
    expect(levelAtCell(w, { col: 2, row: 1 }, 0)).toBe(1);
    expect(levelAtCell(w, { col: 2, row: 2 }, 1)).toBe(0);
  });

  it('returns null where nothing can stand', () => {
    expect(levelAtCell(world(), { col: -1, row: 0 }, 0)).toBeNull();
  });
});
