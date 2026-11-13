import type Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { loadWorld } from '../lib/worldLoader';
import { createGame } from './createGame';
import { DEFAULT_WORLD, worldSource } from './worldSource';

/** Loads the world, then mounts a Phaser game into a div and owns its lifecycle. */
export function PhaserGame() {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string | null>('Loading the plaza...');

  useEffect(() => {
    let cancelled = false;
    let game: Phaser.Game | undefined;
    loadWorld(worldSource, DEFAULT_WORLD)
      .then((world) => {
        if (cancelled) return;
        game = createGame(container.current!, world);
        setStatus(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : String(error));
        }
      });
    // Cleanup matters: StrictMode mounts effects twice in dev, and a leaked game means two canvases.
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, []);

  return (
    <>
      <div ref={container} className="world" />
      {status && <p className="world-status">{status}</p>}
    </>
  );
}
