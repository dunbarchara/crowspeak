import type Phaser from 'phaser';
import { entityDepth } from '../lib/depth';
import type { Footprint, Vec2 } from '../lib/geometry';
import { type Themer } from './palette';

/** The box at the player's feet that collides with the world, separate from the sprite. */
export const PLAYER_FOOTPRINT: Footprint = { halfW: 10, halfH: 5 };

/**
 * Placeholder learner: a rectangle with a shadow. `position` is the point between the
 * feet, which is what collision and sorting use. Swap the shapes for a sprite later.
 */
export class Player {
  /** The visible body. The camera follows this. */
  readonly body: Phaser.GameObjects.Rectangle;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  position: Vec2;
  /** The elevation level the player stands on; picks which collision grid applies. */
  level: number;

  constructor(scene: Phaser.Scene, themer: Themer, position: Vec2, level = 0) {
    this.level = level;
    this.shadow = scene.add.ellipse(0, 0, 28, 12);
    this.body = scene.add.rectangle(0, 0, 20, 34);
    themer.bind((p) => {
      this.shadow.setFillStyle(p.line, 0.15);
      this.body.setFillStyle(p.line);
    });
    this.position = position;
    this.moveTo(position);
  }

  moveTo(position: Vec2): void {
    this.position = position;
    // Drawn on whole pixels so the edges stay sharp; `position` itself stays exact.
    const x = Math.round(position.x);
    const y = Math.round(position.y);
    this.shadow.setPosition(x, y);
    this.body.setPosition(x, y - 17);
    this.applyDepth();
  }

  /** Change level, e.g. after a stair, so the player sorts with that level's objects. */
  setLevel(level: number): void {
    if (level === this.level) return;
    this.level = level;
    this.applyDepth();
  }

  /** Objects lower on screen draw in front, and a higher level draws over a lower one. */
  private applyDepth(): void {
    const depth = entityDepth(this.level, this.position.y);
    this.shadow.setDepth(depth - 1);
    this.body.setDepth(depth);
  }
}
