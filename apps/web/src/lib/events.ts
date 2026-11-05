// A tiny typed event channel. No Phaser or React imports, so it stays pure.

type EventMap = object;

export interface EventChannel<Events extends EventMap> {
  /** Subscribe to an event. Returns a function that unsubscribes. */
  on<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void,
  ): () => void;
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;
}

export function createEventChannel<
  Events extends EventMap,
>(): EventChannel<Events> {
  const listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  return {
    on(event, listener) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
      return () => set.delete(listener);
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((listener) => listener(payload as never));
    },
  };
}
