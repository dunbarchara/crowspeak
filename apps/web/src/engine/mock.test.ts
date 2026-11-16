import { describe, expect, it } from 'vitest';
import { type ChatState, applyEvent, initialChatState } from '../lib/chat';
import type { ConversationTarget } from '../lib/proximity';
import { createMockEngine, mockCorrections } from './mock';
import type { ClientEvent } from './types';

const instant = async () => {};
const single: ConversationTarget = {
  nearestNpcId: 'poncho',
  groupId: null,
  npcIds: ['poncho'],
};
const group: ConversationTarget = {
  nearestNpcId: 'maria',
  groupId: 'fountain-chat',
  npcIds: ['poncho', 'maria'],
};

/** Run the mock to completion and collect what it emitted. */
async function play(target: ConversationTarget, text: string) {
  const engine = createMockEngine({ wait: instant });
  const events: ClientEvent[] = [];
  engine.subscribe((e) => events.push(e));
  engine.start();
  await Promise.resolve();
  events.length = 0;
  engine.sendText(target, text);
  // Let the queued turn and all its instant waits settle.
  for (let i = 0; i < 200; i++) await Promise.resolve();
  return events;
}
const types = (events: ClientEvent[]) => events.map((e) => e.type);

describe('mock engine', () => {
  it('connects and starts a session', async () => {
    const engine = createMockEngine({ wait: instant });
    const events: ClientEvent[] = [];
    engine.subscribe((e) => events.push(e));
    engine.start();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(events).toEqual([
      { type: 'connection_changed', status: 'connecting' },
      { type: 'connection_changed', status: 'connected' },
      {
        sessionId: 'mock-session',
        type: 'session_started',
        learnerId: 'learner',
      },
    ]);
  });

  it('plays a full turn in the engine order', async () => {
    const events = await play(single, 'Hola');
    const t = types(events);
    expect(t[0]).toBe('learner_message');
    expect(t[1]).toBe('turn_started');
    expect(t[2]).toBe('expression_change');
    expect(t.slice(3, -3).every((x) => x === 'transcript_delta')).toBe(true);
    expect(t.slice(-3)).toEqual([
      'transcript_delta',
      'turn_completed',
      'corrections_ready',
    ]);
    // Corrections point at the learner's message.
    const learner = events[0] as Extract<
      ClientEvent,
      { type: 'learner_message' }
    >;
    const corr = events.at(-1) as Extract<
      ClientEvent,
      { type: 'corrections_ready' }
    >;
    expect(corr.messageId).toBe(learner.messageId);
  });

  it('builds a sensible chat state when its events are folded in', async () => {
    const events = await play(single, 'yo soy bien');
    const state: ChatState = events.reduce(
      (s, e, i) => applyEvent(s, e, i),
      initialChatState,
    );
    const messages = state.entries.filter((e) => e.kind === 'message');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', text: 'yo soy bien' });
    expect(
      messages[0].kind === 'message' && messages[0].corrections?.isCorrect,
    ).toBe(false);
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      streaming: false,
      provisional: false,
    });
  });

  it('has only the nearest member of a group reply; the others stay silent', async () => {
    const events = await play(group, 'Hola a todos');
    const skipped = events.filter((e) => e.type === 'turn_skipped');
    expect(skipped.map((e) => 'speakerId' in e && e.speakerId)).toEqual([
      'poncho',
    ]);
    const completed = events.filter((e) => e.type === 'turn_completed');
    expect(completed.map((e) => 'speakerId' in e && e.speakerId)).toEqual([
      'maria',
    ]);
    expect(
      events.every(
        (e) =>
          !('conversationId' in e) || e.conversationId === 'conv:fountain-chat',
      ),
    ).toBe(true);
  });

  it('supports the /error and /silence dev commands', async () => {
    const error = await play(single, '/error');
    expect(types(error)).toEqual([
      'learner_message',
      'turn_started',
      'engine_error',
    ]);
    const silence = await play(single, '/silence');
    expect(types(silence)).toEqual([
      'learner_message',
      'turn_started',
      'turn_skipped',
    ]);
  });

  it('plays overlapping sends one turn at a time', async () => {
    const engine = createMockEngine({ wait: instant });
    const events: ClientEvent[] = [];
    engine.subscribe((e) => events.push(e));
    engine.start();
    engine.sendText(single, 'uno');
    engine.sendText(single, 'dos');
    for (let i = 0; i < 400; i++) await Promise.resolve();
    const order = events
      .filter(
        (e) => e.type === 'learner_message' || e.type === 'corrections_ready',
      )
      .map((e) => e.type);
    expect(order).toEqual([
      'learner_message',
      'corrections_ready',
      'learner_message',
      'corrections_ready',
    ]);
  });

  it('emits nothing after stop', async () => {
    const engine = createMockEngine({ wait: instant });
    const events: ClientEvent[] = [];
    engine.subscribe((e) => events.push(e));
    engine.stop();
    engine.sendText(single, 'Hola');
    for (let i = 0; i < 50; i++) await Promise.resolve();
    expect(events).toEqual([]);
  });
});

describe('mockCorrections', () => {
  it('praises correct text', () => {
    expect(mockCorrections('Buenas tardes')).toMatchObject({
      isCorrect: true,
      praise: '¡Muy bien!',
      items: [],
    });
  });

  it('flags known mistakes with spans and a corrected sentence', () => {
    const c = mockCorrections('Hola, yo soy bien. como estas');
    expect(c.isCorrect).toBe(false);
    expect(c.items.map((i) => i.suggestion)).toEqual([
      'estoy bien',
      'cómo estás',
    ]);
    expect(c.items[0].span).toEqual({ start: 6, end: 17 });
    expect(c.corrected).toBe('Hola, estoy bien. cómo estás');
    expect(c.items.map((i) => i.severity)).toEqual(['error', 'suggestion']);
  });
});
