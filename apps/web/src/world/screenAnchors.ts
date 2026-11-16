/**
 * Where world-anchored HUD elements (speech bubbles) go, in screen pixels over the canvas.
 * Keys are NPC ids, plus `player`. The scene rewrites it every frame after rendering and the
 * HUD reads it in its own animation loop. It is plain mutable data rather than store state
 * because it changes continuously and React never needs to re-render for it.
 */
export const screenAnchors = new Map<string, { x: number; y: number }>();
