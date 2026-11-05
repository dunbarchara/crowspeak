import { createEventChannel } from '../lib/events';

/** Events that cross between the Phaser world and the rest of the app. */
export interface AppEvents {
  /** The player moved into or out of an NPC's interaction range. */
  'npc:proximity': { npcId: string; inRange: boolean };
}

export const appEvents = createEventChannel<AppEvents>();
