import { describe, expect, it } from 'vitest';
import { buildGrid } from './grid';
import { findPath } from './pathfinding';

const cell = (col: number, row: number) => ({ col, row });
const block = (col: number, row: number, cols = 1, rows = 1) => ({
  x: col * 10,
  y: row * 10,
  w: cols * 10,
  h: rows * 10,
});
const gridWith = (
  cols: number,
  rows: number,
  blocked: ReturnType<typeof block>[] = [],
) => buildGrid(cols, rows, 10, { x: 0, y: 0 }, blocked);

describe('findPath', () => {
  it('returns an empty path when already at the goal', () => {
    expect(findPath(gridWith(3, 3), cell(1, 1), cell(1, 1))).toEqual([]);
  });

  it('excludes the start and includes the goal', () => {
    const path = findPath(gridWith(5, 1), cell(0, 0), cell(4, 0));
    expect(path).toEqual([cell(1, 0), cell(2, 0), cell(3, 0), cell(4, 0)]);
  });

  it('takes the diagonal across open ground', () => {
    const path = findPath(gridWith(4, 4), cell(0, 0), cell(3, 3));
    expect(path).toEqual([cell(1, 1), cell(2, 2), cell(3, 3)]);
  });

  it('routes around a wall', () => {
    // Wall in column 2 covering rows 0 and 1, with a gap in the bottom row.
    const grid = gridWith(5, 3, [block(2, 0, 1, 2)]);
    const path = findPath(grid, cell(0, 0), cell(4, 0));
    expect(path).not.toBeNull();
    expect(path!.at(-1)).toEqual(cell(4, 0));
    for (const step of path!) {
      expect(grid.walkable[step.row * grid.cols + step.col]).toBe(true);
    }
    expect(path!.some((step) => step.row === 2)).toBe(true);
  });

  it('does not cut a blocked corner on a diagonal step', () => {
    // With (1, 0) blocked, stepping (0, 0) -> (1, 1) would squeeze past its corner.
    const grid = gridWith(2, 2, [block(1, 0)]);
    expect(findPath(grid, cell(0, 0), cell(1, 1))).toEqual([
      cell(0, 1),
      cell(1, 1),
    ]);
  });

  it('returns null when the goal is blocked, out of bounds or walled off', () => {
    const grid = gridWith(5, 3, [block(2, 0, 1, 3)]);
    expect(findPath(grid, cell(0, 0), cell(2, 1))).toBeNull();
    expect(findPath(grid, cell(0, 0), cell(9, 9))).toBeNull();
    expect(findPath(grid, cell(0, 0), cell(4, 0))).toBeNull();
  });

  it('returns null when the start is blocked', () => {
    expect(
      findPath(gridWith(3, 1, [block(0, 0)]), cell(0, 0), cell(2, 0)),
    ).toBeNull();
  });
});
