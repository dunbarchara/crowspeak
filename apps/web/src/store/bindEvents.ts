import { appEvents } from './channel';
import { useGameStore } from './useGameStore';

/** Route events from the channel into the store. Returns an unsubscribe function. */
export function bindEventsToStore(): () => void {
  return appEvents.on('target:changed', ({ target }) =>
    useGameStore.getState().setTarget(target),
  );
}
