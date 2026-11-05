import { useGameStore } from '../store/useGameStore';

/** React overlay on top of the Phaser canvas. */
export function Hud() {
  const voiceEnabled = useGameStore((state) => state.voiceEnabled);
  const setVoiceEnabled = useGameStore((state) => state.setVoiceEnabled);
  const npcsInRange = useGameStore((state) => state.npcsInRange);

  return (
    <div className="hud">
      <button type="button" onClick={() => setVoiceEnabled(!voiceEnabled)}>
        Voice: {voiceEnabled ? 'on' : 'off'}
      </button>
      <p>In range: {npcsInRange.length ? npcsInRange.join(', ') : 'nobody'}</p>
    </div>
  );
}
