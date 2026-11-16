import type { ConversationTarget } from '../lib/proximity';
import type { EngineClient } from './client';
import type {
  ClientEvent,
  CorrectionItem,
  Corrections,
  EngineEvent,
  Expression,
} from './types';

const SESSION_ID = 'mock-session';
export const MOCK_LEARNER_ID = 'learner';
const LANGUAGE = 'es-MX';

/** Short canned replies, in es-MX, per NPC. Others fall back to `generic`. */
const REPLIES: Record<string, string[]> = {
  poncho: [
    '¡Quiúbole! ¿Quieres un agua de jamaica?',
    'Aquí la hacemos bien fresca. ¿Cuántas quieres?',
  ],
  maria: [
    'Buenas tardes. ¿Vienes por pan dulce?',
    'Hoy tenemos conchas recién hechas.',
  ],
  generic: [
    '¡Hola! ¿Cómo estás hoy?',
    'Qué bien. ¿Ya conoces la plaza?',
    'Con gusto te ayudo, ¿qué necesitas?',
    '¡Muy bien! Sigue practicando.',
  ],
};
const EXPRESSIONS: Expression[] = ['happy', 'thinking', 'neutral'];

/** Mistakes the mock notices in the learner's text, standing in for the corrections analyzer. */
const RULES: Array<
  Omit<CorrectionItem, 'span' | 'confidence'> & { pattern: RegExp }
> = [
  {
    pattern: /\byo soy bien\b/i,
    suggestion: 'estoy bien',
    category: 'grammar',
    severity: 'error',
    explanation: 'Use "estar" for how you feel, not "ser".',
    explanationLanguage: 'en',
    original: '',
  },
  {
    pattern: /\bcomo estas\b/i,
    suggestion: 'cómo estás',
    category: 'accents',
    severity: 'suggestion',
    explanation: 'Questions need accents: "cómo" and "estás".',
    explanationLanguage: 'en',
    original: '',
  },
  {
    pattern: /\bgracias muy\b/i,
    suggestion: 'muchas gracias',
    category: 'naturalness',
    severity: 'suggestion',
    explanation: 'The natural way to say it is "muchas gracias".',
    explanationLanguage: 'en',
    original: '',
  },
];

/** Corrections the mock produces for a message, with spans found like the engine does. */
export function mockCorrections(text: string): Corrections {
  const items: CorrectionItem[] = [];
  let corrected = text;
  for (const { pattern, ...rule } of RULES) {
    const match = pattern.exec(text);
    if (!match) continue;
    items.push({
      ...rule,
      original: match[0],
      span: { start: match.index, end: match.index + match[0].length },
      confidence: 0.9,
    });
    corrected = corrected.replace(pattern, rule.suggestion);
  }
  return {
    language: LANGUAGE,
    original: text,
    corrected,
    isCorrect: items.length === 0,
    items,
    praise: items.length === 0 ? '¡Muy bien!' : null,
    more: [],
  };
}

export interface MockEngineOptions {
  /** Resolves after `ms`. Tests pass an instant one. */
  wait?: (ms: number) => Promise<void>;
}

export interface MockEngine extends EngineClient {
  /** Dev aid: show the reconnecting state for a moment. */
  simulateDrop(): void;
}

/**
 * A scripted stand-in for the engine. Sending text plays a turn: the learner's message, a
 * typing state, an expression, streamed words, the completed message, then corrections for the
 * learner's message. In a group the nearest member replies and the others stay silent.
 * Dev commands: send `/error` for an engine error, `/silence` for a silent NPC.
 */
export function createMockEngine(options: MockEngineOptions = {}): MockEngine {
  const wait =
    options.wait ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const listeners = new Set<(event: ClientEvent) => void>();
  let running = false;
  let counter = 0;
  const replyCounts = new Map<string, number>();
  let queue: Promise<void> = Promise.resolve();

  const emit = (event: ClientEvent) => {
    if (!running) return;
    for (const listener of [...listeners]) listener(event);
  };

  async function runTurn(target: ConversationTarget, text: string) {
    const conversationId = `conv:${target.groupId ?? target.nearestNpcId}`;
    const responder = target.nearestNpcId;
    const messageId = `m${++counter}`;
    const base = { sessionId: SESSION_ID, conversationId };
    const npc = (speakerId: string) => ({ ...base, speakerId });

    emit({ ...npc(MOCK_LEARNER_ID), type: 'learner_message', messageId, text });
    await wait(300);
    for (const id of target.npcIds) emit({ ...npc(id), type: 'turn_started' });

    const command = text.trim().toLowerCase();
    await wait(500);
    for (const id of target.npcIds) {
      if (id !== responder || command === '/silence') {
        emit({ ...npc(id), type: 'turn_skipped', reason: 'not_addressed' });
      }
    }
    if (command === '/error') {
      emit({
        ...npc(responder),
        type: 'engine_error',
        message: 'The provider timed out. Try again.',
        recoverable: true,
      });
      return;
    }
    if (command === '/silence') return;

    const lines = REPLIES[responder] ?? REPLIES.generic;
    const n = replyCounts.get(responder) ?? 0;
    replyCounts.set(responder, n + 1);
    const reply = lines[n % lines.length];
    const speaker = npc(responder);
    emit({
      ...speaker,
      type: 'expression_change',
      label: EXPRESSIONS[n % EXPRESSIONS.length],
    });
    for (const word of reply.split(/(?<= )/)) {
      emit({
        ...speaker,
        type: 'transcript_delta',
        text: word,
        role: 'assistant',
        final: false,
      });
      await wait(70);
    }
    emit({
      ...speaker,
      type: 'transcript_delta',
      text: '',
      role: 'assistant',
      final: true,
    });
    emit({
      ...speaker,
      type: 'turn_completed',
      message: {
        id: `m${++counter}`,
        role: 'assistant',
        content: reply,
        interrupted: false,
      },
    });

    await wait(700);
    emit({
      ...npc(MOCK_LEARNER_ID),
      type: 'corrections_ready',
      messageId,
      corrections: mockCorrections(text),
    } satisfies EngineEvent);
  }

  return {
    start() {
      if (running) return;
      running = true;
      emit({ type: 'connection_changed', status: 'connecting' });
      void wait(600).then(() => {
        emit({ type: 'connection_changed', status: 'connected' });
        emit({
          type: 'session_started',
          sessionId: SESSION_ID,
          learnerId: MOCK_LEARNER_ID,
        });
      });
    },
    stop() {
      running = false;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sendText(target, text) {
      // One turn at a time, so overlapping sends do not interleave their events.
      queue = queue.then(() => runTurn(target, text));
    },
    simulateDrop() {
      emit({ type: 'connection_changed', status: 'reconnecting' });
      void wait(2000).then(() =>
        emit({ type: 'connection_changed', status: 'connected' }),
      );
    },
  };
}
