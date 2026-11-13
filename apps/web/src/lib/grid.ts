import type { Footprint, Rect, Vec2 } from './geometry';

export interface Cell {
  col: number;
  row: number;
}

/** A walkability grid laid over world space. Single level; elevation comes later. */
export interface WalkGrid {
  cols: number;
  rows: number;
  cellSize: number;
  /** World position of the top-left corner of cell (0, 0). */
  originX: number;
  originY: number;
  /** Row-major; true means walkable. */
  walkable: boolean[];
}

/** The inclusive range of cells (possibly outside the grid) that a rectangle touches. */
export function cellRange(
  origin: Vec2,
  cellSize: number,
  rect: Rect,
): { c0: number; c1: number; r0: number; r1: number } {
  return {
    c0: Math.floor((rect.x - origin.x) / cellSize),
    c1: Math.ceil((rect.x + rect.w - origin.x) / cellSize) - 1,
    r0: Math.floor((rect.y - origin.y) / cellSize),
    r1: Math.ceil((rect.y + rect.h - origin.y) / cellSize) - 1,
  };
}

/** Build a grid where every cell touching one of the blocked rectangles is not walkable. */
export function buildGrid(
  cols: number,
  rows: number,
  cellSize: number,
  origin: Vec2,
  blocked: Rect[],
): WalkGrid {
  const walkable = new Array<boolean>(cols * rows).fill(true);
  for (const rect of blocked) {
    const { c0, c1, r0, r1 } = cellRange(origin, cellSize, rect);
    for (let row = Math.max(r0, 0); row <= Math.min(r1, rows - 1); row++) {
      for (let col = Math.max(c0, 0); col <= Math.min(c1, cols - 1); col++) {
        walkable[row * cols + col] = false;
      }
    }
  }
  return {
    cols,
    rows,
    cellSize,
    originX: origin.x,
    originY: origin.y,
    walkable,
  };
}

export function worldToCell(grid: WalkGrid, x: number, y: number): Cell {
  return {
    col: Math.floor((x - grid.originX) / grid.cellSize),
    row: Math.floor((y - grid.originY) / grid.cellSize),
  };
}

/** The world position of a cell's center. */
export function cellToWorld(grid: WalkGrid, cell: Cell): Vec2 {
  return {
    x: grid.originX + (cell.col + 0.5) * grid.cellSize,
    y: grid.originY + (cell.row + 0.5) * grid.cellSize,
  };
}

/** Cells outside the grid count as blocked. */
export function isCellWalkable(
  grid: WalkGrid,
  col: number,
  row: number,
): boolean {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return false;
  return grid.walkable[row * grid.cols + col];
}

/** True when all four corners of the footprint, centered on (x, y), are on walkable cells. */
export function isFootprintWalkable(
  grid: WalkGrid,
  x: number,
  y: number,
  footprint: Footprint,
): boolean {
  for (const dx of [-footprint.halfW, footprint.halfW]) {
    for (const dy of [-footprint.halfH, footprint.halfH]) {
      const cell = worldToCell(grid, x + dx, y + dy);
      if (!isCellWalkable(grid, cell.col, cell.row)) return false;
    }
  }
  return true;
}
