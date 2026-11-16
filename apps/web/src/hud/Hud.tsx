import { useState } from 'react';
import { engineClient } from '../engine';
import type { ConnectionStatus } from '../engine/types';
import { useGameStore } from '../store/useGameStore';
import { ChatPanel } from './ChatPanel';
import { SpeechBubbles } from './SpeechBubbles';
import { VirtualStick } from './VirtualStick';
import { type ThemeChoice, applyTheme, loadTheme, nextTheme } from './theme';

/** Touch devices get the stick. Add `?stick` to the URL to try it with a mouse. */
function wantsStick(): boolean {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    new URLSearchParams(window.location.search).has('stick')
  );
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
};

/** React overlay on top of the Phaser canvas. */
export function Hud() {
  const voiceEnabled = useGameStore((state) => state.voiceEnabled);
  const setVoiceEnabled = useGameStore((state) => state.setVoiceEnabled);
  const connection = useGameStore((state) => state.chat.connection);
  const [showStick] = useState(wantsStick);
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme);

  return (
    <div className="hud">
      <div className="hud-bar">
        <button
          type="button"
          aria-pressed={voiceEnabled}
          onClick={() => setVoiceEnabled(!voiceEnabled)}
        >
          Voice: {voiceEnabled ? 'on' : 'off'}
        </button>
        <span className="status" data-status={connection} role="status">
          <span className="status-dot" aria-hidden="true" />
          {STATUS_LABEL[connection]}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = nextTheme(theme);
            applyTheme(next);
            setTheme(next);
          }}
        >
          Theme: {theme}
        </button>
        {import.meta.env.DEV && (
          <button type="button" onClick={() => engineClient.simulateDrop()}>
            Drop connection
          </button>
        )}
      </div>
      <ChatPanel />
      <SpeechBubbles />
      {showStick ? (
        <VirtualStick />
      ) : (
        <p className="hud-help">
          Move: WASD, arrows or click. G: debug overlay.
        </p>
      )}
    </div>
  );
}
