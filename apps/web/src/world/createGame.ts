import Phaser from 'phaser';
import type { LoadedWorld } from '../lib/worldLoader';
import { PlazaScene } from './PlazaScene';

export function createGame(
  parent: HTMLElement,
  world: LoadedWorld,
): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#f4f1ea',
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [],
  });
  // Added before boot, Phaser queues the scene and starts it with this data once ready.
  game.scene.add('plaza', PlazaScene, true, { world });
  return game;
}
