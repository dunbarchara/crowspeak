export interface ViewInset {
  /** Screen pixels at the left edge that the HUD covers. */
  left: number;
  /** Screen pixels at the top edge that the HUD covers. */
  top: number;
  /** Screen pixels at the bottom edge that the HUD covers. */
  bottom: number;
}

export const NO_INSET: ViewInset = { left: 0, top: 0, bottom: 0 };

/**
 * How much of the screen a docked panel covers. A panel that spans most of the width is docked
 * at the bottom (when it sits in the lower half of the screen) or at the top; any other is
 * docked at the left. `edge` is the opaque margin plus the fade that sit beyond the panel's own
 * edge (see `--chat-margin` and `--chat-fade` in the CSS); the inset includes it, since that
 * strip hides the world just like the panel does. The world uses the inset to center the player
 * in the space that is left over.
 */
export function insetFromPanel(
  rect: { top: number; right: number; bottom: number; width: number },
  viewport: { width: number; height: number },
  edge: number,
): ViewInset {
  if (rect.width < viewport.width * 0.8) {
    return { ...NO_INSET, left: Math.round(rect.right + edge) };
  }
  return (rect.top + rect.bottom) / 2 > viewport.height / 2
    ? { ...NO_INSET, bottom: Math.round(viewport.height - rect.top + edge) }
    : { ...NO_INSET, top: Math.round(rect.bottom + edge) };
}

/**
 * How much of the full centering shift the camera makes. 1 puts the player exactly in the
 * middle of the uncovered space; smaller values keep the player nearer the screen's center,
 * which feels less drastic. Tuned by feel.
 */
export const CAMERA_SHIFT = 0.25;

/**
 * How far past the covered strip the player is kept, in screen pixels: about a sprite's width,
 * so the player is never half in the fade.
 */
export const PLAYER_CLEARANCE = 24;

/**
 * Offset of the player from the middle of the screen along one axis, in screen pixels.
 * `lead` is the covered space at the start of the axis (left, top) and `trail` at the end
 * (right, bottom). Fully centering the player in the uncovered space takes half the
 * difference; `shift` scales that. A small screen needs more than that to keep the player
 * `clear` pixels away from the panel, up to the full centering.
 */
function axisOffset(
  lead: number,
  trail: number,
  size: number | null,
  shift: number,
  clear: number,
): number {
  const full = (lead - trail) / 2;
  const base = full * shift;
  if (size === null) return base;
  if (lead > trail) {
    return Math.min(full, Math.max(base, lead + clear - size / 2));
  }
  if (trail > lead) {
    return Math.max(full, Math.min(base, -(trail + clear - size / 2)));
  }
  return 0;
}

/**
 * Where the camera must sit: the offset of the follow target from the middle of the screen, in
 * world units. Fully centering the player in the uncovered space takes half the inset (the free
 * area's center is half the inset away from the screen's center); `shift` scales that. When the
 * screen `size` (in pixels) is given, the offset is also raised as needed to keep the player
 * clear of the covered strip, so a narrow window still shows the player.
 */
export function followOffsetForInset(
  inset: ViewInset,
  zoom: number,
  shift: number = CAMERA_SHIFT,
  size?: { width: number; height: number },
) {
  return {
    x:
      axisOffset(inset.left, 0, size?.width ?? null, shift, PLAYER_CLEARANCE) /
      zoom,
    // A panel at the bottom pushes the player up, so it counts the other way.
    y:
      axisOffset(
        inset.top,
        inset.bottom,
        size?.height ?? null,
        shift,
        PLAYER_CLEARANCE,
      ) / zoom,
  };
}
