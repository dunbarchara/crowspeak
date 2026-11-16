import type Phaser from 'phaser';
import { entityDepth } from '../lib/depth';
import type { ProximityNpc } from '../lib/proximity';
import type { NpcAnchor } from '../lib/world';
import { type Palette, type Themer, cssColor } from './palette';

const FONT = "'gg sans', 'Segoe UI', system-ui, sans-serif";

/**
 * Placeholder NPC: a rectangle with a shadow and its id as a label, standing with its feet at
 * `position`. NPCs have no collision with the learner (they can overlap freely), and position
 * and level are plain fields, so a walking NPC only needs to update them. The highlight is
 * the same for every selected NPC.
 */
export class Npc implements ProximityNpc {
  readonly npcId: string;
  readonly groupId: string | null;
  position: { x: number; y: number };
  level: number;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly label: Phaser.GameObjects.Text;
  private highlighted = false;
  private palette!: Palette;

  constructor(scene: Phaser.Scene, themer: Themer, anchor: NpcAnchor) {
    this.npcId = anchor.npcId;
    this.groupId = anchor.groupId;
    this.position = { ...anchor.position };
    this.level = anchor.level;
    this.shadow = scene.add.ellipse(0, 0, 32, 14);
    // 1px outline drawn half a pixel in, so it covers exactly one row of pixels.
    this.body = scene.add.rectangle(0, 0, 21, 33);
    this.label = scene.add
      .text(0, 0, anchor.npcId, {
        fontFamily: FONT,
        fontSize: '12px',
        // Text is rasterised once, so it needs the screen's pixel ratio to stay sharp.
        resolution: 1 / scene.scale.zoom,
      })
      .setOrigin(0.5, 1);
    themer.bind((p) => {
      this.palette = p;
      this.label.setColor(cssColor(p.line));
      this.body.setFillStyle(p.bg).setStrokeStyle(1, p.line);
      this.paintShadow();
    });
    this.place();
  }

  /** A highlighted shadow marks an NPC the learner is about to talk to. */
  setHighlighted(on: boolean): void {
    this.highlighted = on;
    this.paintShadow();
  }

  private paintShadow(): void {
    const p = this.palette;
    if (this.highlighted) {
      this.shadow.setFillStyle(p.yellow, 0.9).setStrokeStyle(1, p.line);
    } else this.shadow.setFillStyle(p.line, 0.15).setStrokeStyle();
  }

  private place(): void {
    const { x, y } = this.position;
    const depth = entityDepth(this.level, y);
    const px = Math.round(x);
    const py = Math.round(y);
    this.shadow.setPosition(px, py).setDepth(depth - 1);
    this.body.setPosition(px, py - 17).setDepth(depth);
    this.label.setPosition(px, py - 38).setDepth(depth);
  }
}
