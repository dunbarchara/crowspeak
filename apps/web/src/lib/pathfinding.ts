import { type Cell, type WalkGrid, isCellWalkable } from './grid';

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

/**
 * A* over an 8-way grid. Diagonal steps may not cut a blocked corner.
 * Returns the cells to walk through, excluding the start and including the goal
 * (empty when already there), or null when the goal is blocked or unreachable.
 *
 * The open set is scanned linearly. That is fine for plaza-sized grids; switch to a
 * heap if grids grow past a few thousand cells.
 */
export function findPath(
  grid: WalkGrid,
  start: Cell,
  goal: Cell,
): Cell[] | null {
  if (!isCellWalkable(grid, start.col, start.row)) return null;
  if (!isCellWalkable(grid, goal.col, goal.row)) return null;
  if (start.col === goal.col && start.row === goal.row) return [];

  const index = (c: Cell) => c.row * grid.cols + c.col;
  const size = grid.cols * grid.rows;
  const g = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const open = new Map<number, number>(); // cell index -> f score

  g[index(start)] = 0;
  open.set(index(start), heuristic(start, goal));

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

    const cell: Cell = {
      col: current % grid.cols,
      row: Math.floor(current / grid.cols),
    };
    if (cell.col === goal.col && cell.row === goal.row) {
      const path: Cell[] = [];
      for (let i = current; i !== index(start); i = cameFrom[i]) {
        path.push({ col: i % grid.cols, row: Math.floor(i / grid.cols) });
      }
      return path.reverse();
    }

    for (const { dc, dr, cost } of NEIGHBORS) {
      const next: Cell = { col: cell.col + dc, row: cell.row + dr };
      if (!isCellWalkable(grid, next.col, next.row)) continue;
      if (dc !== 0 && dr !== 0) {
        const sideA = isCellWalkable(grid, cell.col + dc, cell.row);
        const sideB = isCellWalkable(grid, cell.col, cell.row + dr);
        if (!sideA || !sideB) continue;
      }
      const ni = index(next);
      if (closed[ni]) continue;
      const tentative = g[current] + cost;
      if (tentative < g[ni]) {
        g[ni] = tentative;
        cameFrom[ni] = current;
        open.set(ni, tentative + heuristic(next, goal));
      }
    }
  }
  return null;
}
