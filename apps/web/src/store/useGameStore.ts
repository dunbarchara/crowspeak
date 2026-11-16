import { create } from 'zustand';
import type { ClientEvent } from '../engine/types';
import { type ChatState, applyEvent, initialChatState } from '../lib/chat';
import type { ConversationTarget } from '../lib/proximity';

/** Shared, UI-relevant state. Per-frame data (positions, camera) stays in Phaser. */
interface GameState {
  voiceEnabled: boolean;
  /** Who the learner would talk to now: an NPC, a predefined group, or nobody. */
  target: ConversationTarget | null;
  /** Transcript, speech bubbles and connection status, built from engine events. */
  chat: ChatState;
  /** True while the chat input has focus, so the world stops reading the keyboard. */
  chatFocused: boolean;
  setVoiceEnabled: (enabled: boolean) => void;
  setTarget: (target: ConversationTarget | null) => void;
  applyChatEvent: (event: ClientEvent) => void;
  setChatFocused: (focused: boolean) => void;
}

export const useGameStore = create<GameState>()((set) => ({
  voiceEnabled: false,
  target: null,
  chat: initialChatState,
  chatFocused: false,
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setTarget: (target) => set({ target }),
  applyChatEvent: (event) =>
    set((state) => ({ chat: applyEvent(state.chat, event, Date.now()) })),
  setChatFocused: (chatFocused) => set({ chatFocused }),
}));
