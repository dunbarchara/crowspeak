import type { ConversationTarget } from '../lib/proximity';
import type { ClientEvent, NpcInfo } from './types';

/**
 * What the HUD needs from an engine connection. The mock implements it now; the typed
 * gateway adapter (task 8) will implement the same interface.
 */
export interface EngineClient {
  /** The NPCs of the session, by id, for display. */
  readonly npcs: Readonly<Record<string, NpcInfo>>;
  /** Connect and begin emitting events. */
  start(): void;
  stop(): void;
  /** Listen to every event. Returns a function that unsubscribes. */
  subscribe(listener: (event: ClientEvent) => void): () => void;
  /** Send the learner's text to a target: one NPC, or every member of a predefined group. */
  sendText(target: ConversationTarget, text: string): void;
}
