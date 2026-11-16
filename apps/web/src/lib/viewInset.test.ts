import { describe, expect, it } from 'vitest';
import {
  CAMERA_SHIFT,
  PLAYER_CLEARANCE,
  followOffsetForInset,
  insetFromPanel,
} from './viewInset';

describe('insetFromPanel', () => {
  const desktop = { width: 1280, height: 800 };
  const phone = { width: 390, height: 800 };

  it('treats a panel on the left as a left inset, plus the edge strip', () => {
    const rect = { top: 0, right: 540, bottom: 800, width: 540 };
    expect(insetFromPanel(rect, desktop, 32)).toEqual({
      left: 572,
      top: 0,
      bottom: 0,
    });
    // The margin and fade can be changed independently: only their sum matters here.
    expect(insetFromPanel(rect, desktop, 16)).toEqual({
      left: 556,
      top: 0,
      bottom: 0,
    });
  });

  it('treats a wide panel in the lower half as a bottom inset', () => {
    const rect = { top: 400, right: 390, bottom: 800, width: 390 };
    expect(insetFromPanel(rect, phone, 32)).toEqual({
      left: 0,
      top: 0,
      bottom: 432,
    });
  });

  it('treats a wide panel at the top as a top inset', () => {
    const rect = { top: 0, right: 390, bottom: 300, width: 390 };
    expect(insetFromPanel(rect, phone, 32)).toEqual({
      left: 0,
      top: 332,
      bottom: 0,
    });
  });

  it('adds nothing when there is no edge strip', () => {
    const rect = { top: 0, right: 540, bottom: 800, width: 540 };
    expect(insetFromPanel(rect, desktop, 0).left).toBe(540);
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

describe('followOffsetForInset on small screens', () => {
  const left = { left: 552, top: 0, bottom: 0 };

  it('keeps the quarter shift when the screen is wide enough', () => {
    expect(
      followOffsetForInset(left, 1, 0.25, { width: 1280, height: 800 }).x,
    ).toBe(69);
  });

  it('moves the player out of the panel fade when the screen is narrower', () => {
    const width = 900;
    const { x } = followOffsetForInset(left, 1, 0.25, { width, height: 800 });
    // The player lands at least a fade width clear of the panel edge.
    expect(width / 2 + x).toBeGreaterThanOrEqual(552 + PLAYER_CLEARANCE);
    expect(x).toBeGreaterThan(69);
  });

  it('never goes past centering the player in the free area', () => {
    // 500px wide: the free area is so small that keeping a full clearance would need more than
    // centering the player in it (half the inset, 276), so it stops there.
    const width = 500;
    const { x } = followOffsetForInset(left, 1, 0.25, { width, height: 800 });
    expect(x).toBe(276);
  });

  it('does the same for a panel at the bottom, pushing the player up', () => {
    const bottom = { left: 0, top: 0, bottom: 400 };
    const height = 700;
    const { y } = followOffsetForInset(bottom, 1, 0.25, { width: 390, height });
    // The quarter shift would be -50; this short screen needs -74 to stay clear of the strip.
    expect(y).toBe(-74);
    expect(height / 2 + y).toBeLessThanOrEqual(height - 400 - PLAYER_CLEARANCE);
  });
});
