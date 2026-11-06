import type { Footprint, Vec2 } from './geometry';
import { type WalkGrid, isFootprintWalkable } from './grid';

/**
 * Turn an input vector into a velocity. Input longer than 1 (keyboard diagonals) is
 * normalized so diagonals are not faster; shorter input (an analog stick) scales speed.
 */
export function inputToVelocity(input: Vec2, speed: number): Vec2 {
  const length = Math.hypot(input.x, input.y);
  if (length === 0) return { x: 0, y: 0 };
  const scale = speed / Math.max(length, 1);
  return { x: input.x * scale, y: input.y * scale };
}

/** Apply a move one axis at a time, so the entity slides along obstacles instead of sticking. */
export function moveWithCollision(
  grid: WalkGrid,
  position: Vec2,
  delta: Vec2,
  footprint: Footprint,
): Vec2 {
  let { x, y } = position;
  if (isFootprintWalkable(grid, x + delta.x, y, footprint)) x += delta.x;
  if (isFootprintWalkable(grid, x, y + delta.y, footprint)) y += delta.y;
  return { x, y };
}

/** Walk up to `distance` along the waypoints. Returns the new position and the waypoints left. */
export function advanceAlongPath(
  position: Vec2,
  waypoints: Vec2[],
  distance: number,
): { position: Vec2; remaining: Vec2[] } {
  let { x, y } = position;
  let left = distance;
  let next = 0;
  while (next < waypoints.length && left > 0) {
    const target = waypoints[next];
    const gap = Math.hypot(target.x - x, target.y - y);
    if (gap <= left) {
      x = target.x;
      y = target.y;
      left -= gap;
      next++;
    } else {
      x += ((target.x - x) / gap) * left;
      y += ((target.y - y) / gap) * left;
      left = 0;
    }
  }
  return { position: { x, y }, remaining: waypoints.slice(next) };
}
