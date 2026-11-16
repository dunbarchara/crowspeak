import type { EngineClient } from '../engine/client';
import { appEvents } from './channel';
import { useGameStore } from './useGameStore';

/** Route events from the channel into the store. Returns an unsubscribe function. */
export function bindEventsToStore(): () => void {
  return appEvents.on('target:changed', ({ target }) =>
    useGameStore.getState().setTarget(target),
  );
}

/** Route engine events (the mock for now) into the chat state. Returns an unsubscribe function. */
export function bindEngineToStore(client: EngineClient): () => void {
  return client.subscribe((event) =>
    useGameStore.getState().applyChatEvent(event),
  );
}
