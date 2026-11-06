import { describe, expect, it } from 'vitest';
import { buildGrid } from './grid';
import {
  advanceAlongPath,
  inputToVelocity,
  moveWithCollision,
} from './movement';

describe('inputToVelocity', () => {
  it('is zero without input', () => {
    expect(inputToVelocity({ x: 0, y: 0 }, 100)).toEqual({ x: 0, y: 0 });
  });

  it('moves at full speed on one axis', () => {
    expect(inputToVelocity({ x: -1, y: 0 }, 100)).toEqual({ x: -100, y: 0 });
  });

  it('does not make diagonals faster', () => {
    const v = inputToVelocity({ x: 1, y: 1 }, 100);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(100);
  });

  it('scales speed for partial analog input', () => {
    expect(inputToVelocity({ x: 0.5, y: 0 }, 100)).toEqual({ x: 50, y: 0 });
  });
});

describe('moveWithCollision', () => {
  // 3x3 grid of 10px cells with the middle cell blocked.
  const grid = buildGrid(3, 3, 10, { x: 0, y: 0 }, [
    { x: 10, y: 10, w: 10, h: 10 },
  ]);
  const footprint = { halfW: 2, halfH: 2 };

  it('moves freely on open ground', () => {
    expect(
      moveWithCollision(grid, { x: 5, y: 5 }, { x: 2, y: 0 }, footprint),
    ).toEqual({
      x: 7,
      y: 5,
    });
  });

  it('stops at an obstacle', () => {
    expect(
      moveWithCollision(grid, { x: 7, y: 15 }, { x: 5, y: 0 }, footprint),
    ).toEqual({
      x: 7,
      y: 15,
    });
  });

  it('slides along an obstacle on the free axis', () => {
    expect(
      moveWithCollision(grid, { x: 7, y: 15 }, { x: 5, y: 2 }, footprint),
    ).toEqual({
      x: 7,
      y: 17,
    });
  });

  it('does not leave the grid', () => {
    expect(
      moveWithCollision(grid, { x: 3, y: 5 }, { x: -5, y: 0 }, footprint),
    ).toEqual({
      x: 3,
      y: 5,
    });
  });
});

describe('advanceAlongPath', () => {
  const path = [
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];

  it('moves part of the way toward the first waypoint', () => {
    const result = advanceAlongPath({ x: 0, y: 0 }, path, 4);
    expect(result.position).toEqual({ x: 4, y: 0 });
    expect(result.remaining).toEqual(path);
  });

  it('turns the corner with leftover distance', () => {
    const result = advanceAlongPath({ x: 0, y: 0 }, path, 15);
    expect(result.position).toEqual({ x: 10, y: 5 });
    expect(result.remaining).toEqual([{ x: 10, y: 10 }]);
  });

  it('stops at the end of the path', () => {
    const result = advanceAlongPath({ x: 0, y: 0 }, path, 100);
    expect(result.position).toEqual({ x: 10, y: 10 });
    expect(result.remaining).toEqual([]);
  });

  it('does nothing without a path', () => {
    expect(advanceAlongPath({ x: 3, y: 3 }, [], 10)).toEqual({
      position: { x: 3, y: 3 },
      remaining: [],
    });
  });
});
