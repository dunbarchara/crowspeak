import { create } from 'zustand';
import type { ClientEvent } from '../engine/types';
import { type ChatState, applyEvent, initialChatState } from '../lib/chat';
import type { ConversationTarget } from '../lib/proximity';
import { NO_INSET, type ViewInset } from '../lib/viewInset';

/** Shared, UI-relevant state. Per-frame data (positions, camera) stays in Phaser. */
interface GameState {
  voiceEnabled: boolean;
  /** Who the learner would talk to now if they pressed interact: an NPC, a group, or nobody. */
  target: ConversationTarget | null;
  /** The conversation the learner has started (the chat is open), or null. */
  conversation: ConversationTarget | null;
  /** Transcript, speech bubbles and connection status, built from engine events. */
  chat: ChatState;
  /** True while the chat input has focus, so the world stops reading the keyboard. */
  chatFocused: boolean;
  /** How much of the screen the chat covers, so the world can center the player in the rest. */
  viewInset: ViewInset;
  setVoiceEnabled: (enabled: boolean) => void;
  setTarget: (target: ConversationTarget | null) => void;
  /** Open a conversation with the current target. Does nothing without one. */
  startConversation: () => void;
  endConversation: () => void;
  applyChatEvent: (event: ClientEvent) => void;
  setChatFocused: (focused: boolean) => void;
  setViewInset: (inset: ViewInset) => void;
}

export const useGameStore = create<GameState>()((set) => ({
  voiceEnabled: false,
  target: null,
  conversation: null,
  chat: initialChatState,
  chatFocused: false,
  viewInset: NO_INSET,
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  // Who is in range changes freely, but an open conversation does not follow it: it ends only
  // when the learner closes it or walks somewhere else (the scene calls `endConversation`).
  setTarget: (target) => set({ target }),
  startConversation: () =>
    set((state) =>
      state.target && !state.conversation ? { conversation: state.target } : {},
    ),
  endConversation: () => set(closed),
  applyChatEvent: (event) =>
    set((state) => ({ chat: applyEvent(state.chat, event, Date.now()) })),
  setChatFocused: (chatFocused) => set({ chatFocused }),
  setViewInset: (viewInset) => set({ viewInset }),
}));

/** Closing the chat also releases the keyboard and gives the screen back to the world. */
const closed = {
  conversation: null,
  chatFocused: false,
  viewInset: NO_INSET,
} as const;
