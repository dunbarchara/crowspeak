import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { VirtualStick } from './VirtualStick';

/** Touch devices get the stick. Add `?stick` to the URL to try it with a mouse. */
function wantsStick(): boolean {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    new URLSearchParams(window.location.search).has('stick')
  );
}

/** React overlay on top of the Phaser canvas. */
export function Hud() {
  const voiceEnabled = useGameStore((state) => state.voiceEnabled);
  const setVoiceEnabled = useGameStore((state) => state.setVoiceEnabled);
  const target = useGameStore((state) => state.target);
  const [showStick] = useState(wantsStick);

  return (
    <div className="hud">
      <button type="button" onClick={() => setVoiceEnabled(!voiceEnabled)}>
        Voice: {voiceEnabled ? 'on' : 'off'}
      </button>
      <p>
        Talking to:{' '}
        {target
          ? `${target.npcIds.join(', ')}${target.groupId ? ` (group ${target.groupId})` : ''}`
          : 'nobody'}
      </p>
      <p>Move: WASD or arrows, or click. G: debug overlay.</p>
      {showStick && <VirtualStick />}
    </div>
  );
}
