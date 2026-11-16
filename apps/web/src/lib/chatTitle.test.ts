import { describe, expect, it } from 'vitest';
import { conversationTitle, npcLabel, npcName } from './chatTitle';

const directory = {
  chloe: { id: 'chloe', name: 'Chloe', role: 'traveler' },
  rosa: { id: 'rosa', name: 'Rosa', role: 'student' },
  mario: { id: 'mario', name: 'Mario', role: 'plumber' },
  extra: { id: 'extra', name: 'Extra', role: null },
};

describe('npc names', () => {
  it('uses the display name, or the id when unknown', () => {
    expect(npcName(directory, 'chloe')).toBe('Chloe');
    expect(npcName(directory, 'ghost')).toBe('ghost');
  });

  it('adds the role in parentheses when there is one', () => {
    expect(npcLabel(directory, 'chloe')).toBe('Chloe (traveler)');
    expect(npcLabel(directory, 'extra')).toBe('Extra');
    expect(npcLabel(directory, 'ghost')).toBe('ghost');
  });
});

describe('conversationTitle', () => {
  it('names a single NPC', () => {
    expect(conversationTitle(directory, ['chloe'], false)).toBe(
      'Chat: Chloe (traveler)',
    );
  });

  it('lists the members of a group, separated by semicolons', () => {
    expect(conversationTitle(directory, ['rosa', 'mario'], true)).toBe(
      'Group: Rosa (student) ; Mario (plumber)',
    );
  });

  it('treats several NPCs as a group even without a group flag', () => {
    expect(conversationTitle(directory, ['rosa', 'mario'], false)).toMatch(
      /^Group: /,
    );
  });
});
