import type { Rect, Vec2 } from './geometry';
import { rectContains } from './geometry';
import {
  type Cell,
  type WalkGrid,
  buildGrid,
  cellToWorld,
  isCellWalkable,
} from './grid';

/** Ground the learner can stand on at one elevation level. */
export interface Region {
  level: number;
  rect: Rect;
}

/** The collision box at the base of an object, separate from its sprite. */
export interface FootprintObject {
  id: string;
  level: number;
  rect: Rect;
}

/** The side of a stair zone where the higher level connects. */
export type Edge = 'n' | 's' | 'e' | 'w';

/**
 * A transition zone between two levels. The zone is walkable on both levels. Inside it,
 * the half nearer `highEdge` is on the high level and the other half on the low level.
 */
export interface StairZone {
  id: string;
  rect: Rect;
  low: number;
  high: number;
  highEdge: Edge;
}

/** One walkability grid per level (index = level), all with the same geometry. */
export interface LevelWorld {
  grids: WalkGrid[];
  stairs: StairZone[];
}

export interface LevelCell extends Cell {
  level: number;
}

/**
 * Build the per-level grids. A cell is walkable on a level when its center is inside one
 * of that level's regions and no footprint on that level touches it. Stair zones are
 * opened on both of their levels last, so a stair always wins over a footprint.
 */
export function buildLevelWorld(
  cols: number,
  rows: number,
  cellSize: number,
  origin: Vec2,
  regions: Region[],
  footprints: FootprintObject[],
  stairs: StairZone[],
): LevelWorld {
  const levelCount =
    Math.max(-1, ...regions.map((r) => r.level), ...stairs.map((s) => s.high)) +
    1;
  const levels = Array.from({ length: levelCount }, (_, i) => i);
  for (const item of [...regions, ...footprints]) {
    if (!Number.isInteger(item.level) || item.level < 0) {
      throw new Error(`Invalid level ${item.level}`);
    }
  }
  for (const stair of stairs) {
    if (stair.low < 0 || stair.low >= stair.high) {
      throw new Error(`Stair ${stair.id}: low must be below high`);
    }
  }

  const grids = levels.map((level) => {
    const grid = buildGrid(
      cols,
      rows,
      cellSize,
      origin,
      footprints.filter((f) => f.level === level).map((f) => f.rect),
    );
    const own = regions.filter((r) => r.level === level);
    forEachCell(grid, (col, row, i) => {
      const center = cellToWorld(grid, { col, row });
      if (!own.some((r) => rectContains(r.rect, center))) {
        grid.walkable[i] = false;
      }
    });
    for (const stair of stairs) {
      if (stair.low !== level && stair.high !== level) continue;
      forEachCell(grid, (col, row, i) => {
        if (rectContains(stair.rect, cellToWorld(grid, { col, row }))) {
          grid.walkable[i] = true;
        }
      });
    }
    return grid;
  });
  return { grids, stairs };
}

function forEachCell(
  grid: WalkGrid,
  visit: (col: number, row: number, index: number) => void,
): void {
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      visit(col, row, row * grid.cols + col);
    }
  }
}

/**
 * The level of an entity at `position` that was on `current`. Outside stair zones the level
 * does not change; inside one it follows the stair's half. Zones that do not join `current`
 * are ignored.
 */
export function resolveLevel(
  stairs: StairZone[],
  current: number,
  position: Vec2,
): number {
  for (const stair of stairs) {
    if (current !== stair.low && current !== stair.high) continue;
    if (!rectContains(stair.rect, position)) continue;
    const { x, y, w, h } = stair.rect;
    const onHighSide =
      stair.highEdge === 'n'
        ? position.y < y + h / 2
        : stair.highEdge === 's'
          ? position.y >= y + h / 2
          : stair.highEdge === 'w'
            ? position.x < x + w / 2
            : position.x >= x + w / 2;
    return onHighSide ? stair.high : stair.low;
  }
  return current;
}

/**
 * The level a cell belongs to, trying `preferred` first, or null when no level can stand
 * there. A cell is only on a level that agrees with the stair rule at the cell's center.
 */
export function levelAtCell(
  world: LevelWorld,
  cell: Cell,
  preferred: number,
): number | null {
  const center = cellToWorld(world.grids[0], cell);
  const order = [
    preferred,
    ...world.grids.map((_, level) => level).filter((l) => l !== preferred),
  ];
  for (const level of order) {
    const grid = world.grids[level];
    if (!isCellWalkable(grid, cell.col, cell.row)) continue;
    if (resolveLevel(world.stairs, level, center) === level) return level;
  }
  return null;
}
