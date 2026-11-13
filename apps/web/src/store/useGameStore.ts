import { create } from 'zustand';
import type { ConversationTarget } from '../lib/proximity';

/** Shared, UI-relevant state. Per-frame data (positions, camera) stays in Phaser. */
interface GameState {
  voiceEnabled: boolean;
  /** Who the learner would talk to now: an NPC, a predefined group, or nobody. */
  target: ConversationTarget | null;
  setVoiceEnabled: (enabled: boolean) => void;
  setTarget: (target: ConversationTarget | null) => void;
}

export const useGameStore = create<GameState>()((set) => ({
  voiceEnabled: false,
  target: null,
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setTarget: (target) => set({ target }),
}));
