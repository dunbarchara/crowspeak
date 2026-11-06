import { describe, expect, it } from 'vitest';
import {
  buildGrid,
  cellToWorld,
  isCellWalkable,
  isFootprintWalkable,
  worldToCell,
} from './grid';

// 4x3 grid of 10px cells whose top-left corner is the world origin.
const open = () => buildGrid(4, 3, 10, { x: 0, y: 0 }, []);

describe('buildGrid', () => {
  it('blocks every cell a rectangle touches', () => {
    const grid = buildGrid(4, 3, 10, { x: 0, y: 0 }, [
      { x: 5, y: 5, w: 10, h: 10 },
    ]);
    // Covers x 5..15, y 5..15: cells (0..1, 0..1).
    expect(isCellWalkable(grid, 0, 0)).toBe(false);
    expect(isCellWalkable(grid, 1, 1)).toBe(false);
    expect(isCellWalkable(grid, 2, 0)).toBe(true);
  });

  it('ignores the part of a rectangle outside the grid', () => {
    const grid = buildGrid(4, 3, 10, { x: 0, y: 0 }, [
      { x: -50, y: -50, w: 55, h: 55 },
    ]);
    expect(isCellWalkable(grid, 0, 0)).toBe(false);
    expect(isCellWalkable(grid, 1, 0)).toBe(true);
  });
});

describe('cell conversion', () => {
  it('round-trips through a cell center', () => {
    const grid = buildGrid(4, 3, 10, { x: -20, y: -15 }, []);
    const center = cellToWorld(grid, { col: 2, row: 1 });
    expect(center).toEqual({ x: 5, y: 0 });
    expect(worldToCell(grid, center.x, center.y)).toEqual({ col: 2, row: 1 });
  });
});

describe('walkability', () => {
  it('treats cells outside the grid as blocked', () => {
    const grid = open();
    expect(isCellWalkable(grid, -1, 0)).toBe(false);
    expect(isCellWalkable(grid, 4, 0)).toBe(false);
    expect(isCellWalkable(grid, 0, 3)).toBe(false);
  });

  it('checks all four footprint corners', () => {
    const grid = buildGrid(4, 3, 10, { x: 0, y: 0 }, [
      { x: 20, y: 0, w: 10, h: 10 },
    ]);
    const footprint = { halfW: 4, halfH: 4 };
    expect(isFootprintWalkable(grid, 10, 10, footprint)).toBe(true);
    // Corner at (21, 6) lands in the blocked cell (2, 0).
    expect(isFootprintWalkable(grid, 17, 10, footprint)).toBe(false);
    // Corner would leave the grid.
    expect(isFootprintWalkable(grid, 2, 10, footprint)).toBe(false);
  });
});
