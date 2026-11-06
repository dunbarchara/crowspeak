import Phaser from 'phaser';
import type { Rect, Vec2 } from '../lib/geometry';
import { buildGrid, cellToWorld, worldToCell } from '../lib/grid';
import {
  advanceAlongPath,
  inputToVelocity,
  moveWithCollision,
} from '../lib/movement';
import { findPath } from '../lib/pathfinding';
import { appEvents } from '../store/channel';
import { useGameStore } from '../store/useGameStore';
import { PLAYER_FOOTPRINT, Player } from './Player';
import { virtualStick } from './virtualStick';

const INK = 0x222222;
const PAPER = 0xf4f1ea;
const STONE = 0xcfcabd;
const HIGHLIGHT = 0xe5a50a;
const DEBUG_BLOCKED = 0xd23b3b;

const CELL = 32;
const COLS = 24;
const ROWS = 16;
const ORIGIN: Vec2 = { x: -(COLS * CELL) / 2, y: -(ROWS * CELL) / 2 };
const SPEED = 160; // world pixels per second

const NPC_RECT: Rect = { x: -32, y: -32, w: 64, h: 64 };
/** Temporary test obstacles. The real plaza replaces these. */
const OBSTACLES: Rect[] = [
  { x: -224, y: -128, w: 96, h: 64 },
  { x: 128, y: -160, w: 64, h: 128 },
  { x: -160, y: 64, w: 160, h: 32 },
  { x: 160, y: 64, w: 32, h: 96 },
];

const grid = buildGrid(COLS, ROWS, CELL, ORIGIN, [NPC_RECT, ...OBSTACLES]);

/**
 * Placeholder plaza: a walkable test area with a few obstacles and one clickable NPC square.
 * - Movement: WASD or arrow keys, a virtual stick on touch devices, or click/tap to walk there.
 * - Press G to toggle the debug overlay (blocked cells, path, footprint).
 * - Store wiring: the label follows `voiceEnabled`, the NPC square follows `npcsInRange`,
 *   and clicking the square emits `npc:proximity` on the channel.
 */
export class PlazaScene extends Phaser.Scene {
  private player!: Player;
  private path: Vec2[] = [];
  private marker!: Phaser.GameObjects.Arc;
  private debug!: Phaser.GameObjects.Graphics;
  private debugOn = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

  constructor() {
    super('plaza');
  }

  create() {
    this.add
      .rectangle(0, 0, COLS * CELL, ROWS * CELL)
      .setStrokeStyle(2, INK)
      .setDepth(-10_000); // always behind everything
    for (const r of OBSTACLES) {
      this.add
        .rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, STONE)
        .setStrokeStyle(2, INK)
        // Sort by the bottom edge, like the player's feet, so walking in front or behind works.
        .setDepth(r.y + r.h);
    }

    const npcId = 'npc-demo';
    const npc = this.add
      .rectangle(0, 0, NPC_RECT.w, NPC_RECT.h, PAPER)
      .setStrokeStyle(3, INK)
      .setDepth(NPC_RECT.y + NPC_RECT.h)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(0, 60, '', { color: '#222222', fontSize: '16px' })
      .setOrigin(0.5)
      .setDepth(60);

    let inRange = false;
    npc.on('pointerdown', () => {
      inRange = !inRange;
      appEvents.emit('npc:proximity', { npcId, inRange });
    });

    this.player = new Player(this, { x: 0, y: 150 });
    this.cameras.main.startFollow(this.player.body, true, 0.15, 0.15);
    this.marker = this.add
      .circle(0, 0, 6)
      .setStrokeStyle(2, INK)
      .setVisible(false);
    this.debug = this.add.graphics().setDepth(10_000);

    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = {
      w: keyboard.addKey('W'),
      a: keyboard.addKey('A'),
      s: keyboard.addKey('S'),
      d: keyboard.addKey('D'),
    };
    keyboard.on('keydown-G', () => {
      this.debugOn = !this.debugOn;
      if (!this.debugOn) this.debug.clear();
    });

    // Click or tap to walk. Presses on interactive objects (the NPC) are not movement.
    this.input.on(
      'pointerdown',
      (
        pointer: Phaser.Input.Pointer,
        over: Phaser.GameObjects.GameObject[],
      ) => {
        if (over.length > 0) return;
        const goal = worldToCell(grid, pointer.worldX, pointer.worldY);
        const start = worldToCell(
          grid,
          this.player.position.x,
          this.player.position.y,
        );
        const cells = findPath(grid, start, goal);
        if (!cells) return;
        this.path = cells.map((cell) => cellToWorld(grid, cell));
        const target = cellToWorld(grid, goal);
        this.marker.setPosition(target.x, target.y).setVisible(true);
      },
    );

    const render = (state: ReturnType<typeof useGameStore.getState>) => {
      npc.setFillStyle(state.npcsInRange.includes(npcId) ? HIGHLIGHT : PAPER);
      label.setText(
        `voice: ${state.voiceEnabled ? 'on' : 'off'} (click the square)`,
      );
    };
    render(useGameStore.getState());
    const unsubscribe = useGameStore.subscribe(render);

    // `game.destroy()` emits DESTROY, not SHUTDOWN, so listen for both. A leaked store
    // subscription from a destroyed scene throws on its dead objects and breaks live scenes.
    const cleanup = () => unsubscribe();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  update(_time: number, delta: number) {
    // Cap the step so a stalled frame (tab switch) cannot teleport the player through walls.
    const dt = Math.min(delta, 50) / 1000;
    const input = this.readInput();

    if (input.x !== 0 || input.y !== 0) {
      // Manual input cancels any tap-to-move in progress.
      this.path = [];
      this.marker.setVisible(false);
      const v = inputToVelocity(input, SPEED);
      this.player.moveTo(
        moveWithCollision(
          grid,
          this.player.position,
          { x: v.x * dt, y: v.y * dt },
          PLAYER_FOOTPRINT,
        ),
      );
    } else if (this.path.length > 0) {
      const step = advanceAlongPath(
        this.player.position,
        this.path,
        SPEED * dt,
      );
      this.player.moveTo(step.position);
      this.path = step.remaining;
      if (this.path.length === 0) this.marker.setVisible(false);
    }

    if (this.debugOn) this.drawDebug();
  }

  private readInput(): Vec2 {
    const { cursors, wasd } = this;
    const x =
      Number(cursors.right.isDown || wasd.d.isDown) -
      Number(cursors.left.isDown || wasd.a.isDown);
    const y =
      Number(cursors.down.isDown || wasd.s.isDown) -
      Number(cursors.up.isDown || wasd.w.isDown);
    return { x: x + virtualStick.x, y: y + virtualStick.y };
  }

  private drawDebug() {
    const g = this.debug;
    g.clear();

    g.fillStyle(DEBUG_BLOCKED, 0.25);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!grid.walkable[row * COLS + col]) {
          g.fillRect(ORIGIN.x + col * CELL, ORIGIN.y + row * CELL, CELL, CELL);
        }
      }
    }

    g.lineStyle(2, DEBUG_BLOCKED, 1);
    let from = this.player.position;
    for (const point of this.path) {
      g.lineBetween(from.x, from.y, point.x, point.y);
      from = point;
    }

    const { x, y } = this.player.position;
    g.lineStyle(1, DEBUG_BLOCKED, 1);
    g.strokeRect(
      x - PLAYER_FOOTPRINT.halfW,
      y - PLAYER_FOOTPRINT.halfH,
      PLAYER_FOOTPRINT.halfW * 2,
      PLAYER_FOOTPRINT.halfH * 2,
    );
  }
}
