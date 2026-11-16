import { beforeEach, describe, expect, it } from 'vitest';
import type { ConversationTarget } from '../lib/proximity';
import { useGameStore } from './useGameStore';

const target = (...npcIds: string[]): ConversationTarget => ({
  nearestNpcId: npcIds[0],
  groupId: npcIds.length > 1 ? 'g' : null,
  npcIds,
});
const state = () => useGameStore.getState();

beforeEach(() => {
  state().endConversation();
  state().setTarget(null);
});

describe('conversations', () => {
  it('start only with someone in range', () => {
    state().startConversation();
    expect(state().conversation).toBeNull();
    state().setTarget(target('poncho'));
    state().startConversation();
    expect(state().conversation).toEqual(target('poncho'));
  });

  it('keep the conversation target even as the live target changes within the group', () => {
    state().setTarget(target('poncho', 'maria'));
    state().startConversation();
    state().setTarget({ ...target('poncho', 'maria'), nearestNpcId: 'maria' });
    expect(state().conversation?.nearestNpcId).toBe('poncho');
  });

  it('stay open when the learner drifts out of range or toward someone else', () => {
    state().setTarget(target('poncho'));
    state().startConversation();
    state().setTarget(null);
    expect(state().conversation).toEqual(target('poncho'));
    state().setTarget(target('rosa'));
    expect(state().conversation).toEqual(target('poncho'));
  });

  it('are not affected by target changes when none is open', () => {
    state().setTarget(target('poncho'));
    state().setTarget(target('rosa'));
    expect(state().conversation).toBeNull();
    expect(state().target?.npcIds).toEqual(['rosa']);
  });

  it('release the keyboard and the screen when ended by hand', () => {
    state().setTarget(target('poncho'));
    state().startConversation();
    state().setChatFocused(true);
    state().setViewInset({ left: 384, top: 0, bottom: 0 });
    state().endConversation();
    expect(state()).toMatchObject({
      conversation: null,
      chatFocused: false,
      viewInset: { left: 0, top: 0, bottom: 0 },
    });
  });
});
