import type Phaser from 'phaser';
import { entityDepth } from '../lib/depth';
import type { ProximityNpc } from '../lib/proximity';
import type { NpcAnchor } from '../lib/world';

const INK = 0x222222;
const PAPER = 0xf4f1ea;
const HIGHLIGHT = 0xe5a50a;

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

  constructor(scene: Phaser.Scene, anchor: NpcAnchor) {
    this.npcId = anchor.npcId;
    this.groupId = anchor.groupId;
    this.position = { ...anchor.position };
    this.level = anchor.level;
    this.shadow = scene.add.ellipse(0, 0, 32, 14, INK, 0.25);
    this.body = scene.add.rectangle(0, 0, 22, 34, PAPER).setStrokeStyle(2, INK);
    this.label = scene.add
      .text(0, 0, anchor.npcId, { color: '#222222', fontSize: '12px' })
      .setOrigin(0.5, 1);
    this.place();
  }

  /** A highlighted shadow marks an NPC the learner is about to talk to. */
  setHighlighted(on: boolean): void {
    if (on) this.shadow.setFillStyle(HIGHLIGHT, 0.9).setStrokeStyle(2, INK);
    else this.shadow.setFillStyle(INK, 0.25).setStrokeStyle();
  }

  private place(): void {
    const { x, y } = this.position;
    const depth = entityDepth(this.level, y);
    this.shadow.setPosition(x, y).setDepth(depth - 1);
    this.body.setPosition(x, y - 17).setDepth(depth);
    this.label.setPosition(x, y - 38).setDepth(depth);
  }
}
