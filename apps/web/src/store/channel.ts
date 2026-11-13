import { createEventChannel } from '../lib/events';
import type { ConversationTarget } from '../lib/proximity';

/** Events that cross between the Phaser world and the rest of the app. */
export interface AppEvents {
  /**
   * Who the learner would talk to if they interacted now: one NPC, a predefined group, or
   * nobody. Sent whenever it changes, and carries the whole state.
   */
  'target:changed': { target: ConversationTarget | null };
}

export const appEvents = createEventChannel<AppEvents>();
