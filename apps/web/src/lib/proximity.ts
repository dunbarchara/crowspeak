import type { Vec2 } from './geometry';

/** An NPC as proximity sees it: where it stands and which predefined group it belongs to. */
export interface ProximityNpc {
  npcId: string;
  level: number;
  position: Vec2;
  groupId: string | null;
}

/**
 * Who the learner would talk to if they interacted now. A lone NPC is a target of one. A
 * predefined group is one target: approaching any member selects every member. `nearestNpcId`
 * is the member the learner is actually closest to.
 */
export interface ConversationTarget {
  nearestNpcId: string;
  groupId: string | null;
  npcIds: string[];
}

/** World pixels, measured between feet. Leaving needs a larger radius than entering so the target does not flicker. */
export const ENTER_RADIUS = 48;
export const EXIT_RADIUS = 64;
/** Another NPC must be this much closer than the current target to take over. */
export const SWITCH_MARGIN = 16;

/**
 * Choose the conversation target for a learner standing at `position` on `level`. Only NPCs
 * on the learner's level count. The nearest one in range wins, and its whole group comes
 * with it. `current` gives hysteresis: its members stay selected out to EXIT_RADIUS, and a
 * different NPC takes over only if it is clearly closer.
 */
export function pickTarget(
  player: { position: Vec2; level: number },
  npcs: ProximityNpc[],
  current: ConversationTarget | null,
): ConversationTarget | null {
  const currentIds = new Set(current?.npcIds);
  const distance = (n: ProximityNpc) =>
    Math.hypot(
      n.position.x - player.position.x,
      n.position.y - player.position.y,
    );

  const eligible = npcs
    .filter((n) => n.level === player.level)
    .map((n) => ({ npc: n, d: distance(n) }))
    .filter(
      ({ npc, d }) =>
        d <= (currentIds.has(npc.npcId) ? EXIT_RADIUS : ENTER_RADIUS),
    )
    .sort((a, b) => a.d - b.d || a.npc.npcId.localeCompare(b.npc.npcId));
  if (eligible.length === 0) return null;

  let best = eligible[0];
  const incumbent = eligible.find(({ npc }) => currentIds.has(npc.npcId));
  if (incumbent && incumbent.d <= best.d + SWITCH_MARGIN) best = incumbent;

  const { npc } = best;
  const members = npc.groupId
    ? npcs.filter((n) => n.groupId === npc.groupId).map((n) => n.npcId)
    : [npc.npcId];
  return { nearestNpcId: npc.npcId, groupId: npc.groupId, npcIds: members };
}

export function sameTarget(
  a: ConversationTarget | null,
  b: ConversationTarget | null,
): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.nearestNpcId === b.nearestNpcId &&
    a.groupId === b.groupId &&
    a.npcIds.length === b.npcIds.length &&
    a.npcIds.every((id, i) => id === b.npcIds[i])
  );
}
