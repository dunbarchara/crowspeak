export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned rectangle; x and y are the top-left corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Half-extents of the box at an entity's base that collides with the world. */
export interface Footprint {
  halfW: number;
  halfH: number;
}

/** True when the point is inside the rectangle (left and top edges inclusive, right and bottom exclusive). */
export function rectContains(rect: Rect, point: Vec2): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.w &&
    point.y >= rect.y &&
    point.y < rect.y + rect.h
  );
}
