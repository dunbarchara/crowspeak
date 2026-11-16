import { describe, expect, it } from 'vitest';
import {
  CAMERA_SHIFT,
  followOffsetForInset,
  insetFromPanel,
} from './viewInset';

describe('insetFromPanel', () => {
  const desktop = { width: 1280, height: 800 };
  const phone = { width: 390, height: 800 };

  it('treats a panel on the left as a left inset, with a gap', () => {
    expect(
      insetFromPanel({ top: 56, right: 372, bottom: 760, width: 360 }, desktop),
    ).toEqual({ left: 384, top: 0, bottom: 0 });
  });

  it('treats a wide panel in the lower half as a bottom inset', () => {
    expect(
      insetFromPanel({ top: 400, right: 378, bottom: 788, width: 366 }, phone),
    ).toEqual({ left: 0, top: 0, bottom: 412 });
  });

  it('treats a wide panel at the top as a top inset', () => {
    expect(
      insetFromPanel({ top: 96, right: 378, bottom: 300, width: 366 }, phone),
    ).toEqual({ left: 0, top: 312, bottom: 0 });
  });
});

describe('followOffsetForInset', () => {
  it('shifts the player by half the covered space at a full shift', () => {
    expect(
      followOffsetForInset({ left: 384, top: 0, bottom: 0 }, 1, 1),
    ).toEqual({
      x: 192,
      y: 0,
    });
  });

  it('defaults to a quarter of the full shift', () => {
    expect(CAMERA_SHIFT).toBe(0.25);
    expect(followOffsetForInset({ left: 384, top: 0, bottom: 0 }, 1)).toEqual({
      x: 48,
      y: 0,
    });
    expect(followOffsetForInset({ left: 0, top: 200, bottom: 0 }, 1)).toEqual({
      x: 0,
      y: 25,
    });
  });

  it('is in world units, so zooming in shrinks it', () => {
    expect(
      followOffsetForInset({ left: 0, top: 300, bottom: 0 }, 2, 1),
    ).toEqual({
      x: 0,
      y: 75,
    });
  });

  it('pushes the player up for a bottom inset', () => {
    expect(
      followOffsetForInset({ left: 0, top: 0, bottom: 400 }, 1, 1),
    ).toEqual({ x: 0, y: -200 });
    // At the default quarter shift: 400 / 2 * 0.25.
    expect(followOffsetForInset({ left: 0, top: 0, bottom: 400 }, 1).y).toBe(
      -50,
    );
  });

  it('centers the player in the free area at a full shift', () => {
    const width = 1280;
    const inset = { left: 384, top: 0, bottom: 0 };
    const offset = followOffsetForInset(inset, 1, 1);
    const freeCenter = inset.left + (width - inset.left) / 2;
    expect(width / 2 + offset.x).toBe(freeCenter);
  });
});
