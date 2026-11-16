import { useGameStore } from '../store/useGameStore';

/** Shown when someone is in range and no conversation is open. Also the way in on touch devices. */
export function InteractPrompt() {
  const target = useGameStore((state) => state.target);
  const conversation = useGameStore((state) => state.conversation);
  const startConversation = useGameStore((state) => state.startConversation);
  if (!target || conversation) return null;
  return (
    <button type="button" className="prompt" onClick={startConversation}>
      <kbd>E</kbd> Talk to {target.npcIds.join(', ')}
    </button>
  );
}
