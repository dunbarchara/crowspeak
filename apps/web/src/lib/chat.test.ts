import { describe, expect, it } from 'vitest';
import type { ClientEvent, Corrections } from '../engine/types';
import {
  type ChatMessage,
  type ChatState,
  applyEvent,
  initialChatState,
} from './chat';

const base = { sessionId: 's', conversationId: 'c1', speakerId: 'poncho' };
const run = (events: ClientEvent[], from: ChatState = initialChatState) =>
  events.reduce((state, event, i) => applyEvent(state, event, 1_000 + i), from);
const messages = (state: ChatState) =>
  state.entries.filter((e): e is ChatMessage => e.kind === 'message');

const delta = (text: string, final = false): ClientEvent => ({
  ...base,
  type: 'transcript_delta',
  text,
  role: 'assistant',
  final,
});
const completed = (content: string, id = 'm9'): ClientEvent => ({
  ...base,
  type: 'turn_completed',
  message: { id, role: 'assistant', content, interrupted: false },
});

describe('connection and session', () => {
  it('tracks the connection status and the learner id', () => {
    const state = run([
      { type: 'connection_changed', status: 'connected' },
      { sessionId: 's', type: 'session_started', learnerId: 'learner' },
    ]);
    expect(state.connection).toBe('connected');
    expect(state.learnerId).toBe('learner');
  });
});

describe('learner messages', () => {
  it('adds the message and a bubble over the learner', () => {
    const state = run([
      {
        ...base,
        speakerId: 'learner',
        type: 'learner_message',
        messageId: 'm1',
        text: 'Hola',
      },
    ]);
    expect(messages(state)).toMatchObject([
      { id: 'm1', role: 'user', text: 'Hola', corrections: null },
    ]);
    expect(state.bubbles.learner).toEqual({
      text: 'Hola',
      typing: false,
      at: 1_000,
    });
  });
});

describe('an NPC turn', () => {
  it('shows typing, then streams text into one message, then finalizes it by id', () => {
    let state = run([{ ...base, type: 'turn_started' }]);
    expect(state.bubbles.poncho).toMatchObject({ typing: true, text: '' });

    state = run(
      [
        { ...base, type: 'expression_change', label: 'happy' },
        delta('¡Quiúbole! '),
        delta('¿Quieres agua?'),
      ],
      state,
    );
    expect(messages(state)).toHaveLength(1);
    expect(messages(state)[0]).toMatchObject({
      text: '¡Quiúbole! ¿Quieres agua?',
      streaming: true,
      provisional: true,
      expression: 'happy',
    });
    expect(state.bubbles.poncho).toMatchObject({
      typing: false,
      text: '¡Quiúbole! ¿Quieres agua?',
    });

    state = run(
      [delta('', true), completed('¡Quiúbole! ¿Quieres agua?')],
      state,
    );
    expect(messages(state)).toHaveLength(1);
    expect(messages(state)[0]).toMatchObject({
      id: 'm9',
      streaming: false,
      provisional: false,
      expression: 'happy',
    });
  });

  it('keeps the typing dots while the expression arrives before any text', () => {
    const state = run([
      { ...base, type: 'turn_started' },
      { ...base, type: 'expression_change', label: 'thinking' },
    ]);
    expect(state.bubbles.poncho.typing).toBe(true);
    expect(messages(state)[0]).toMatchObject({
      text: '',
      expression: 'thinking',
    });
  });

  it('keeps replies from different NPCs and conversations apart', () => {
    const maria = { ...base, speakerId: 'maria' };
    const state = run([
      delta('uno '),
      {
        ...maria,
        type: 'transcript_delta',
        text: 'dos ',
        role: 'assistant',
        final: false,
      },
      delta('tres'),
    ]);
    expect(messages(state).map((m) => [m.speakerId, m.text])).toEqual([
      ['poncho', 'uno tres'],
      ['maria', 'dos '],
    ]);
  });

  it('adds a completed message that never streamed', () => {
    const state = run([completed('Hola')]);
    expect(messages(state)).toMatchObject([{ id: 'm9', text: 'Hola' }]);
  });
});

describe('silence and errors', () => {
  it('turns a skipped turn into a notice and clears the typing bubble', () => {
    const state = run([
      { ...base, type: 'turn_started' },
      { ...base, type: 'turn_skipped', reason: 'not_addressed' },
    ]);
    expect(state.bubbles.poncho).toBeUndefined();
    expect(state.entries).toMatchObject([
      {
        kind: 'notice',
        tone: 'silence',
        speakerId: 'poncho',
        detail: 'not_addressed',
      },
    ]);
  });

  it('drops an empty streaming reply on an engine error and adds an error notice', () => {
    const state = run([
      { ...base, type: 'turn_started' },
      { ...base, type: 'expression_change', label: 'neutral' },
      {
        ...base,
        type: 'engine_error',
        message: 'timed out',
        recoverable: true,
      },
    ]);
    expect(messages(state)).toHaveLength(0);
    expect(state.entries).toMatchObject([
      { kind: 'notice', tone: 'error', detail: 'timed out' },
    ]);
    expect(state.bubbles.poncho).toBeUndefined();
  });

  it('keeps partial text when the error comes mid-reply', () => {
    const state = run([
      delta('Aquí la '),
      { ...base, type: 'engine_error', message: 'cut off', recoverable: true },
    ]);
    expect(messages(state)[0].text).toBe('Aquí la ');
    expect(state.entries).toHaveLength(2);
  });

  it('shows an analyzer error without touching the conversation', () => {
    const state = run([
      {
        ...base,
        type: 'analyzer_error',
        analyzer: 'corrections',
        messageId: 'm1',
        message: 'bad json',
      },
    ]);
    expect(state.entries).toMatchObject([{ kind: 'notice', tone: 'error' }]);
  });
});

describe('corrections', () => {
  const corrections: Corrections = {
    language: 'es-MX',
    original: 'yo soy bien',
    corrected: 'estoy bien',
    isCorrect: false,
    items: [],
    praise: null,
    more: [],
  };

  it('attach to the learner message by id, even after the NPC replied', () => {
    const state = run([
      {
        ...base,
        speakerId: 'learner',
        type: 'learner_message',
        messageId: 'm1',
        text: 'yo soy bien',
      },
      delta('Qué bien.'),
      completed('Qué bien.', 'm2'),
      {
        ...base,
        speakerId: 'learner',
        type: 'corrections_ready',
        messageId: 'm1',
        corrections,
      },
    ]);
    const [learner, npc] = messages(state);
    expect(learner.corrections).toBe(corrections);
    expect(npc.corrections).toBeNull();
  });

  it('are ignored when the message is unknown', () => {
    const state = run([
      { ...base, type: 'corrections_ready', messageId: 'nope', corrections },
    ]);
    expect(state.entries).toHaveLength(0);
  });
});

describe('bounds', () => {
  it('keeps only the most recent entries', () => {
    const events: ClientEvent[] = Array.from({ length: 250 }, (_, i) => ({
      ...base,
      speakerId: 'learner',
      type: 'learner_message' as const,
      messageId: `m${i}`,
      text: String(i),
    }));
    const state = run(events);
    expect(state.entries).toHaveLength(200);
    expect(messages(state).at(-1)?.id).toBe('m249');
  });
});
