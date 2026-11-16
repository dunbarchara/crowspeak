import type {
  ClientEvent,
  ConnectionStatus,
  Corrections,
  Expression,
} from '../engine/types';

/** A chat line. For an NPC reply, `provisional` means it is still streaming under a local id. */
export interface ChatMessage {
  kind: 'message';
  id: string;
  conversationId: string;
  speakerId: string;
  role: 'user' | 'assistant';
  text: string;
  streaming: boolean;
  provisional: boolean;
  expression: Expression | null;
  corrections: Corrections | null;
  interrupted: boolean;
}

/** A small line between messages: an NPC that stayed silent, or something that went wrong. */
export interface ChatNotice {
  kind: 'notice';
  id: string;
  tone: 'silence' | 'error';
  speakerId: string;
  /** The skip reason, or the error message. */
  detail: string;
}

export type ChatEntry = ChatMessage | ChatNotice;

/** What a world-anchored speech bubble shows. `typing` means a turn started with no text yet. */
export interface Bubble {
  text: string;
  typing: boolean;
  /** When it last changed (ms), so the HUD can fade it after a while. */
  at: number;
}

export interface ChatState {
  learnerId: string | null;
  entries: ChatEntry[];
  bubbles: Record<string, Bubble>;
  connection: ConnectionStatus;
}

export const initialChatState: ChatState = {
  learnerId: null,
  entries: [],
  bubbles: {},
  connection: 'connecting',
};

const MAX_ENTRIES = 200;

function withoutBubble(
  bubbles: Record<string, Bubble>,
  speakerId: string,
): Record<string, Bubble> {
  const { [speakerId]: _removed, ...rest } = bubbles;
  return rest;
}

/** Index of the reply still streaming for this speaker in this conversation, or -1. */
function findProvisional(
  entries: ChatEntry[],
  conversationId: string,
  speakerId: string,
): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (
      e.kind === 'message' &&
      e.provisional &&
      e.conversationId === conversationId &&
      e.speakerId === speakerId
    ) {
      return i;
    }
  }
  return -1;
}

function replaceAt<T>(items: T[], index: number, item: T): T[] {
  return items.map((existing, i) => (i === index ? item : existing));
}

function push(entries: ChatEntry[], entry: ChatEntry): ChatEntry[] {
  const next = [...entries, entry];
  return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
}

/**
 * Fold one event into the chat state. Pure: `now` comes from the caller. Streamed text builds a
 * provisional message that `turn_completed` finalizes under the engine's message id; corrections
 * arrive later and attach to the learner's message by id.
 */
export function applyEvent(
  state: ChatState,
  event: ClientEvent,
  now: number,
): ChatState {
  switch (event.type) {
    case 'connection_changed':
      return { ...state, connection: event.status };

    case 'session_started':
      return { ...state, learnerId: event.learnerId };

    case 'learner_message':
      return {
        ...state,
        entries: push(state.entries, {
          kind: 'message',
          id: event.messageId,
          conversationId: event.conversationId,
          speakerId: event.speakerId,
          role: 'user',
          text: event.text,
          streaming: false,
          provisional: false,
          expression: null,
          corrections: null,
          interrupted: false,
        }),
        bubbles: {
          ...state.bubbles,
          [event.speakerId]: { text: event.text, typing: false, at: now },
        },
      };

    case 'turn_started':
      return {
        ...state,
        bubbles: {
          ...state.bubbles,
          [event.speakerId]: { text: '', typing: true, at: now },
        },
      };

    case 'turn_skipped':
      return {
        ...state,
        entries: push(state.entries, {
          kind: 'notice',
          id: `skip:${event.conversationId}:${event.speakerId}:${state.entries.length}`,
          tone: 'silence',
          speakerId: event.speakerId,
          detail: event.reason,
        }),
        bubbles: withoutBubble(state.bubbles, event.speakerId),
      };

    case 'expression_change':
    case 'transcript_delta': {
      const index = findProvisional(
        state.entries,
        event.conversationId,
        event.speakerId,
      );
      const current: ChatMessage =
        index >= 0
          ? (state.entries[index] as ChatMessage)
          : {
              kind: 'message',
              id: `stream:${event.conversationId}:${event.speakerId}:${state.entries.length}`,
              conversationId: event.conversationId,
              speakerId: event.speakerId,
              role:
                event.type === 'transcript_delta' && event.role === 'user'
                  ? 'user'
                  : 'assistant',
              text: '',
              streaming: true,
              provisional: true,
              expression: null,
              corrections: null,
              interrupted: false,
            };
      const next: ChatMessage =
        event.type === 'expression_change'
          ? { ...current, expression: event.label }
          : {
              ...current,
              text: current.text + event.text,
              streaming: !event.final,
            };
      const entries =
        index >= 0
          ? replaceAt<ChatEntry>(state.entries, index, next)
          : push(state.entries, next);
      // The bubble keeps showing the typing dots until there is text to show.
      const bubbles =
        next.text === ''
          ? state.bubbles
          : {
              ...state.bubbles,
              [event.speakerId]: { text: next.text, typing: false, at: now },
            };
      return { ...state, entries, bubbles };
    }

    case 'turn_completed': {
      const index = findProvisional(
        state.entries,
        event.conversationId,
        event.speakerId,
      );
      const done: ChatMessage = {
        kind: 'message',
        id: event.message.id,
        conversationId: event.conversationId,
        speakerId: event.speakerId,
        role: event.message.role === 'user' ? 'user' : 'assistant',
        text: event.message.content,
        streaming: false,
        provisional: false,
        expression:
          index >= 0 ? (state.entries[index] as ChatMessage).expression : null,
        corrections: null,
        interrupted: event.message.interrupted,
      };
      return {
        ...state,
        entries:
          index >= 0
            ? replaceAt<ChatEntry>(state.entries, index, done)
            : push(state.entries, done),
        bubbles: {
          ...state.bubbles,
          [event.speakerId]: { text: done.text, typing: false, at: now },
        },
      };
    }

    case 'corrections_ready':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.kind === 'message' && e.id === event.messageId
            ? { ...e, corrections: event.corrections }
            : e,
        ),
      };

    case 'analyzer_error':
      return {
        ...state,
        entries: push(state.entries, {
          kind: 'notice',
          id: `analyzer:${event.messageId}:${state.entries.length}`,
          tone: 'error',
          speakerId: event.speakerId,
          detail: event.message,
        }),
      };

    case 'engine_error': {
      // Drop a reply that never got text, so it does not sit there empty.
      const index = findProvisional(
        state.entries,
        event.conversationId,
        event.speakerId,
      );
      const stale =
        index >= 0 && (state.entries[index] as ChatMessage).text === '';
      const entries = stale
        ? state.entries.filter((_, i) => i !== index)
        : state.entries;
      return {
        ...state,
        entries: push(entries, {
          kind: 'notice',
          id: `error:${event.conversationId}:${event.speakerId}:${state.entries.length}`,
          tone: 'error',
          speakerId: event.speakerId,
          detail: event.message,
        }),
        bubbles: withoutBubble(state.bubbles, event.speakerId),
      };
    }
  }
}
