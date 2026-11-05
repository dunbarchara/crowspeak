import Phaser from 'phaser';
import { PlazaScene } from './PlazaScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#f4f1ea',
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [PlazaScene],
  });
}
