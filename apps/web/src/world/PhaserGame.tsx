import { useEffect, useRef } from 'react';
import { createGame } from './createGame';

/** Mounts a Phaser game into a div and owns its lifecycle. */
export function PhaserGame() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const game = createGame(container.current!);
    // Cleanup matters: StrictMode mounts effects twice in dev, and a leaked game means two canvases.
    return () => game.destroy(true);
  }, []);

  return <div ref={container} className="world" />;
}
