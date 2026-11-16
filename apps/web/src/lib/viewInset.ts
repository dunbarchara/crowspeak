export interface ViewInset {
  /** Screen pixels at the left edge that the HUD covers. */
  left: number;
  /** Screen pixels at the top edge that the HUD covers. */
  top: number;
  /** Screen pixels at the bottom edge that the HUD covers. */
  bottom: number;
}

export const NO_INSET: ViewInset = { left: 0, top: 0, bottom: 0 };

/** Space kept between a docked panel and the visible part of the world. */
const GAP = 12;

/**
 * How much of the screen a docked panel covers. A panel that spans most of the width is docked
 * at the bottom (when it sits in the lower half of the screen) or at the top; any other is
 * docked at the left. The world uses this to center the player in the space that is left over.
 */
export function insetFromPanel(
  rect: { top: number; right: number; bottom: number; width: number },
  viewport: { width: number; height: number },
): ViewInset {
  if (rect.width < viewport.width * 0.8) {
    return { ...NO_INSET, left: Math.round(rect.right + GAP) };
  }
  return (rect.top + rect.bottom) / 2 > viewport.height / 2
    ? { ...NO_INSET, bottom: Math.round(viewport.height - rect.top + GAP) }
    : { ...NO_INSET, top: Math.round(rect.bottom + GAP) };
}

/**
 * How much of the full centering shift the camera makes. 1 puts the player exactly in the
 * middle of the uncovered space; smaller values keep the player nearer the screen's center,
 * which feels less drastic. Tuned by feel.
 */
export const CAMERA_SHIFT = 0.25;

/**
 * Where the camera must sit: the offset of the follow target from the middle of the screen, in
 * world units. Fully centering the player in the uncovered space takes half the inset (the free
 * area's center is half the inset away from the screen's center); `shift` scales that.
 */
export function followOffsetForInset(
  inset: ViewInset,
  zoom: number,
  shift: number = CAMERA_SHIFT,
) {
  return {
    x: ((inset.left / 2) * shift) / zoom,
    // A panel at the bottom pushes the player up, so it counts the other way.
    y: (((inset.top - inset.bottom) / 2) * shift) / zoom,
  };
}
