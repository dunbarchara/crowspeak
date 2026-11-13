import { describe, expect, it } from 'vitest';
import {
  ENTER_RADIUS,
  EXIT_RADIUS,
  type ProximityNpc,
  pickTarget,
  sameTarget,
} from './proximity';

const npc = (
  npcId: string,
  x: number,
  y = 0,
  groupId: string | null = null,
  level = 0,
): ProximityNpc => ({ npcId, level, position: { x, y }, groupId });
const at = (x: number, y = 0, level = 0) => ({ position: { x, y }, level });

describe('pickTarget', () => {
  it('selects nobody when no NPC is in range', () => {
    expect(pickTarget(at(0), [npc('a', ENTER_RADIUS + 1)], null)).toBeNull();
    expect(pickTarget(at(0), [], null)).toBeNull();
  });

  it('selects a lone NPC in range, with no group', () => {
    expect(pickTarget(at(0), [npc('a', ENTER_RADIUS)], null)).toEqual({
      nearestNpcId: 'a',
      groupId: null,
      npcIds: ['a'],
    });
  });

  it('highlights only the nearest of NPCs that are next to each other but not a group', () => {
    const npcs = [npc('far', 50), npc('near', 30)];
    expect(pickTarget(at(0), npcs, null)?.npcIds).toEqual(['near']);
  });

  it('selects the whole group when the learner approaches any member', () => {
    const npcs = [
      npc('a', 30, 0, 'chat'),
      npc('b', 500, 0, 'chat'), // far away, still part of the target
      npc('c', 40),
    ];
    expect(pickTarget(at(0), npcs, null)).toEqual({
      nearestNpcId: 'a',
      groupId: 'chat',
      npcIds: ['a', 'b'],
    });
    // Approaching the other member selects the same group.
    expect(pickTarget(at(500), npcs, null)?.npcIds).toEqual(['a', 'b']);
  });

  it('prefers a lone NPC over a group member that is farther away', () => {
    const npcs = [
      npc('a', 50, 0, 'chat'),
      npc('b', 500, 0, 'chat'),
      npc('c', 20),
    ];
    expect(pickTarget(at(0), npcs, null)?.npcIds).toEqual(['c']);
  });

  it('ignores NPCs on other levels', () => {
    const npcs = [npc('under', 10, 0, null, 0), npc('above', 20, 0, null, 1)];
    expect(pickTarget(at(0, 0, 0), npcs, null)?.npcIds).toEqual(['under']);
    expect(pickTarget(at(0, 0, 1), npcs, null)?.npcIds).toEqual(['above']);
    expect(pickTarget(at(0, 0, 2), npcs, null)).toBeNull();
  });

  it('keeps the current target out to the exit radius, but does not select at that range', () => {
    const npcs = [npc('a', ENTER_RADIUS + 10)];
    expect(pickTarget(at(0), npcs, null)).toBeNull();
    const current = { nearestNpcId: 'a', groupId: null, npcIds: ['a'] };
    expect(pickTarget(at(0), npcs, current)).toEqual(current);
    expect(pickTarget(at(0), [npc('a', EXIT_RADIUS + 1)], current)).toBeNull();
  });

  it('does not flip between two NPCs that are almost equally near', () => {
    const npcs = [npc('a', 40), npc('b', 60)];
    const first = pickTarget(at(0), npcs, null)!;
    expect(first.nearestNpcId).toBe('a');
    // The learner moves so b is slightly nearer (a is 12 away, b is 8); a stays selected.
    expect(pickTarget(at(52), npcs, first)?.nearestNpcId).toBe('a');
    // When b is clearly nearer (10 against 30, more than the switch margin), it takes over.
    expect(pickTarget(at(70), npcs, first)?.nearestNpcId).toBe('b');
  });

  it('breaks exact ties by npc id so the result is stable', () => {
    const npcs = [npc('b', 30), npc('a', -30)];
    expect(pickTarget(at(0), npcs, null)?.nearestNpcId).toBe('a');
  });
});

describe('sameTarget', () => {
  const t = { nearestNpcId: 'a', groupId: 'g', npcIds: ['a', 'b'] };
  it('compares by value, including null', () => {
    expect(sameTarget(null, null)).toBe(true);
    expect(sameTarget(t, null)).toBe(false);
    expect(sameTarget(t, { ...t, npcIds: ['a', 'b'] })).toBe(true);
    expect(sameTarget(t, { ...t, nearestNpcId: 'b' })).toBe(false);
    expect(sameTarget(t, { ...t, npcIds: ['a'] })).toBe(false);
  });
});

describe('overlap (zero distance)', () => {
  it('selects an NPC the learner stands exactly on', () => {
    expect(pickTarget(at(10, 20), [npc('a', 10, 20)], null)).toEqual({
      nearestNpcId: 'a',
      groupId: null,
      npcIds: ['a'],
    });
  });

  it('stays stable while the learner walks straight through an NPC', () => {
    const npcs = [npc('a', 0)];
    let target = null as ReturnType<typeof pickTarget>;
    for (let x = -ENTER_RADIUS; x <= ENTER_RADIUS; x += 4) {
      const next = pickTarget(at(x), npcs, target);
      expect(next?.npcIds).toEqual(['a']);
      target = next;
    }
  });

  it('picks deterministically when NPCs stand on the same spot', () => {
    const npcs = [npc('b', 5, 5), npc('a', 5, 5)];
    expect(pickTarget(at(5, 5), npcs, null)?.nearestNpcId).toBe('a');
    expect(pickTarget(at(5, 5), npcs.reverse(), null)?.nearestNpcId).toBe('a');
    // A group stacked on one spot is still one target with every member.
    const group = [npc('b', 5, 5, 'g'), npc('a', 5, 5, 'g')];
    expect(pickTarget(at(5, 5), group, null)?.npcIds).toEqual(['b', 'a']);
  });

  it('keeps the incumbent over an NPC standing on the learner when it is close enough', () => {
    const current = { nearestNpcId: 'a', groupId: null, npcIds: ['a'] };
    // a is 10 away, b is exactly on the learner (0): within the margin, so a stays.
    expect(
      pickTarget(at(0), [npc('a', 10), npc('b', 0)], current)?.nearestNpcId,
    ).toBe('a');
    // a is 40 away: b takes over.
    expect(
      pickTarget(at(0), [npc('a', 40), npc('b', 0)], current)?.nearestNpcId,
    ).toBe('b');
  });
});
