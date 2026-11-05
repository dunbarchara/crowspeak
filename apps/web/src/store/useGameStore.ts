import { create } from 'zustand';

/** Shared, UI-relevant state. Per-frame data (positions, camera) stays in Phaser. */
interface GameState {
  voiceEnabled: boolean;
  npcsInRange: string[];
  setVoiceEnabled: (enabled: boolean) => void;
  setNpcInRange: (npcId: string, inRange: boolean) => void;
}

export const useGameStore = create<GameState>()((set) => ({
  voiceEnabled: false,
  npcsInRange: [],
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setNpcInRange: (npcId, inRange) =>
    set((state) => {
      const rest = state.npcsInRange.filter((id) => id !== npcId);
      return { npcsInRange: inRange ? [...rest, npcId] : rest };
    }),
}));
