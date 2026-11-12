import { type Cell, type WalkGrid, cellToWorld, isCellWalkable } from './grid';
import { type LevelCell, type LevelWorld, resolveLevel } from './levels';

const SQRT2 = Math.SQRT2;
const NEIGHBORS = [
  { dc: 1, dr: 0, cost: 1 },
  { dc: -1, dr: 0, cost: 1 },
  { dc: 0, dr: 1, cost: 1 },
  { dc: 0, dr: -1, cost: 1 },
  { dc: 1, dr: 1, cost: SQRT2 },
  { dc: 1, dr: -1, cost: SQRT2 },
  { dc: -1, dr: 1, cost: SQRT2 },
  { dc: -1, dr: -1, cost: SQRT2 },
];

/** Octile distance: exact cost on an open 8-way grid, so it never overestimates. */
function heuristic(a: Cell, b: Cell): number {
  const dc = Math.abs(a.col - b.col);
  const dr = Math.abs(a.row - b.row);
  return Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr);
}

interface Edge {
  index: number;
  cost: number;
}

/**
 * A* over an abstract graph of `size` nodes. Returns the node indices to walk through,
 * excluding the start and including the goal (empty when already there), or null when the
 * goal is unreachable.
 *
 * The open set is scanned linearly. That is fine for plaza-sized graphs; switch to a
 * heap if they grow past a few thousand nodes.
 */
function search(
  size: number,
  start: number,
  goal: number,
  edges: (node: number) => Edge[],
  estimate: (node: number) => number,
): number[] | null {
  if (start === goal) return [];
  const g = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const open = new Map<number, number>(); // node -> f score

  g[start] = 0;
  open.set(start, estimate(start));

  while (open.size > 0) {
    let current = -1;
    let best = Infinity;
    for (const [i, f] of open) {
      if (f < best) {
        best = f;
        current = i;
      }
    }
    open.delete(current);
    closed[current] = 1;

    if (current === goal) {
      const path: number[] = [];
      for (let i = current; i !== start; i = cameFrom[i]) path.push(i);
      return path.reverse();
    }

    for (const { index, cost } of edges(current)) {
      if (closed[index]) continue;
      const tentative = g[current] + cost;
      if (tentative < g[index]) {
        g[index] = tentative;
        cameFrom[index] = current;
        open.set(index, tentative + estimate(index));
      }
    }
  }
  return null;
}

/**
 * A* over an 8-way grid. Diagonal steps may not cut a blocked corner.
 * Returns the cells to walk through, excluding the start and including the goal
 * (empty when already there), or null when the goal is blocked or unreachable.
 */
export function findPath(
  grid: WalkGrid,
  start: Cell,
  goal: Cell,
): Cell[] | null {
  if (!isCellWalkable(grid, start.col, start.row)) return null;
  if (!isCellWalkable(grid, goal.col, goal.row)) return null;

  const toCell = (i: number): Cell => ({
    col: i % grid.cols,
    row: Math.floor(i / grid.cols),
  });
  const toIndex = (c: Cell) => c.row * grid.cols + c.col;

  const path = search(
    grid.cols * grid.rows,
    toIndex(start),
    toIndex(goal),
    (node) => {
      const cell = toCell(node);
      const edges: Edge[] = [];
      for (const { dc, dr, cost } of NEIGHBORS) {
        const next: Cell = { col: cell.col + dc, row: cell.row + dr };
        if (!isCellWalkable(grid, next.col, next.row)) continue;
        if (dc !== 0 && dr !== 0) {
          const sideA = isCellWalkable(grid, cell.col + dc, cell.row);
          const sideB = isCellWalkable(grid, cell.col, cell.row + dr);
          if (!sideA || !sideB) continue;
        }
        edges.push({ index: toIndex(next), cost });
      }
      return edges;
    },
    (node) => heuristic(toCell(node), goal),
  );
  return path && path.map(toCell);
}

/**
 * A* across elevation levels. A node is a cell on a level. Stepping onto a cell takes the
 * level the stair rule gives that cell's center, so crossing a stair's midline changes level
 * at no extra cost. Same path conventions as `findPath`; each cell carries its level.
 */
export function findLevelPath(
  world: LevelWorld,
  start: LevelCell,
  goal: LevelCell,
): LevelCell[] | null {
  const { grids, stairs } = world;
  const { cols, rows } = grids[0];
  const per = cols * rows;
  const walkableAt = (c: LevelCell) =>
    !!grids[c.level] && isCellWalkable(grids[c.level], c.col, c.row);
  if (!walkableAt(start) || !walkableAt(goal)) return null;

  const toCell = (i: number): LevelCell => ({
    level: Math.floor(i / per),
    col: (i % per) % cols,
    row: Math.floor((i % per) / cols),
  });
  const toIndex = (c: LevelCell) => c.level * per + c.row * cols + c.col;

  const path = search(
    grids.length * per,
    toIndex(start),
    toIndex(goal),
    (node) => {
      const cell = toCell(node);
      const grid = grids[cell.level];
      const edges: Edge[] = [];
      for (const { dc, dr, cost } of NEIGHBORS) {
        const col = cell.col + dc;
        const row = cell.row + dr;
        const level = resolveLevel(
          stairs,
          cell.level,
          cellToWorld(grid, { col, row }),
        );
        const next: LevelCell = { level, col, row };
        if (!walkableAt(next)) continue;
        if (dc !== 0 && dr !== 0) {
          const sideA = isCellWalkable(grid, cell.col + dc, cell.row);
          const sideB = isCellWalkable(grid, cell.col, cell.row + dr);
          if (!sideA || !sideB) continue;
        }
        edges.push({ index: toIndex(next), cost });
      }
      return edges;
    },
    (node) => heuristic(toCell(node), goal),
  );
  return path && path.map(toCell);
}
