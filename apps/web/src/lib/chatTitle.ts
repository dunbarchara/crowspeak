import type { NpcInfo } from '../engine/types';

export type NpcDirectory = Readonly<Record<string, NpcInfo>>;

/** An NPC's display name, falling back to its id when the directory does not know it. */
export function npcName(directory: NpcDirectory, id: string): string {
  return directory[id]?.name ?? id;
}

/** "Name (role)", or just the name when there is no role. */
export function npcLabel(directory: NpcDirectory, id: string): string {
  const info = directory[id];
  if (!info) return id;
  return info.role ? `${info.name} (${info.role})` : info.name;
}

/**
 * The chat window's title: `Chat: Chloe (traveler)` for one NPC and
 * `Group: Rosa (student) ; Mario (plumber)` for a predefined group.
 */
export function conversationTitle(
  directory: NpcDirectory,
  npcIds: readonly string[],
  grouped: boolean,
): string {
  const labels = npcIds.map((id) => npcLabel(directory, id));
  return grouped || labels.length > 1
    ? `Group: ${labels.join(' ; ')}`
    : `Chat: ${labels[0] ?? ''}`;
}
