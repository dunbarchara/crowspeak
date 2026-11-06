import type { Vec2 } from '../lib/geometry';

/**
 * The virtual stick's current input, each axis from -1 to 1.
 * The HUD writes it from touch events and the scene reads it every frame. It is plain
 * mutable data rather than store state because it changes continuously and React never
 * needs to re-render for it.
 */
export const virtualStick: Vec2 = { x: 0, y: 0 };

export function setVirtualStick(x: number, y: number): void {
  virtualStick.x = x;
  virtualStick.y = y;
}
