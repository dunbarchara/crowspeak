import Phaser from 'phaser';
import {
  GROUND_DEPTH,
  deckDepth,
  entityDepth,
  overheadDepth,
} from '../lib/depth';
import type { Vec2 } from '../lib/geometry';
import { cellToWorld, worldToCell } from '../lib/grid';
import { type LevelWorld, levelAtCell, resolveLevel } from '../lib/levels';
import {
  advanceAlongPath,
  inputToVelocity,
  moveWithCollision,
} from '../lib/movement';
import { findLevelPath } from '../lib/pathfinding';
import type { WorldDefinition } from '../lib/world';
import type { LoadedWorld } from '../lib/worldLoader';
import { appEvents } from '../store/channel';
import { useGameStore } from '../store/useGameStore';
import { PLAYER_FOOTPRINT, Player } from './Player';
import { virtualStick } from './virtualStick';

const INK = 0x222222;
const PAPER = 0xf4f1ea;
const TERRACE = 0xe6e2d6;
const STONE = 0xcfcabd;
const CLIFF = 0x9d978a;
const STAIRS = 0xd9d4c7;
const HIGHLIGHT = 0xe5a50a;
const DEBUG = 0xd23b3b;

const SPEED = 160; // world pixels per second

/** Flat layers, all below every entity. Entity, deck and overhead depths come from `lib/depth`. */
const DEPTH_STAIRS = GROUND_DEPTH + 500;
const DEPTH_DECOR = GROUND_DEPTH + 1_000; // flat decoration such as cliff faces
const DEPTH_DEBUG = 100_000;
const DEBUG_REGION = 0x1565c0;

const FILL: Record<string, number> = {
  building: STONE,
  pillar: STONE,
  'arch-top': STONE,
  cliff: CLIFF,
  fountain: PAPER,
  npc: PAPER,
};
const FLAT_KINDS = new Set(['cliff']);

/**
 * The town plaza, built from a loaded world (`lib/worldLoader`, passed in as scene data): two elevation levels joined
 * by stairs, buildings, a fountain, an arch to walk through, and one clickable NPC square.
 * - Movement: WASD or arrow keys, a virtual stick on touch devices, or click/tap to walk there.
 * - Press G to toggle the debug overlay (footprints, stairs, blocked cells, path, level).
 * - Store wiring: the label follows `voiceEnabled`, the NPC square follows `npcsInRange`,
 *   and clicking the square emits `npc:proximity` on the channel.
 */
export class PlazaScene extends Phaser.Scene {
  private definition!: WorldDefinition;
  private world!: LevelWorld;
  private footprintBottom = new Map<string, number>();
  private player!: Player;
  private path: Vec2[] = [];
  private marker!: Phaser.GameObjects.Arc;
  private debug!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private debugOn = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

  constructor() {
    super('plaza');
  }

  init(data: { world: LoadedWorld }) {
    this.definition = data.world.definition;
    this.world = data.world.levels;
    this.footprintBottom = new Map(
      this.definition.footprints.map((f) => [f.id, f.rect.y + f.rect.h]),
    );
  }

  create() {
    this.drawGround();

    let npcPropId: string | null = null;
    let npcBox: Phaser.GameObjects.Rectangle | null = null;
    for (const p of this.definition.props) {
      const { x, y, w, h } = p.rect;
      const box = this.add
        .rectangle(x + w / 2, y + h / 2, w, h, FILL[p.kind] ?? STONE)
        .setStrokeStyle(2, INK);
      if (FLAT_KINDS.has(p.kind)) {
        box.setDepth(DEPTH_DECOR);
      } else {
        // Sort by the footprint's bottom edge, like the player's feet, so walking in front
        // of or behind an object works whatever its sprite looks like.
        box.setDepth(
          entityDepth(
            p.level,
            this.footprintBottom.get(p.footprint ?? '') ?? y + h,
          ),
        );
      }
      if (p.npcId) {
        npcPropId = p.npcId;
        npcBox = box;
      }
    }
    for (const o of this.definition.overhead) {
      const { x, y, w, h } = o.rect;
      this.add
        .rectangle(x + w / 2, y + h / 2, w, h, FILL[o.kind] ?? STONE)
        .setStrokeStyle(2, INK)
        .setDepth(overheadDepth(o.level));
    }

    const label = this.add
      .text(0, 0, '', { color: '#222222', fontSize: '16px' })
      .setOrigin(0.5)
      .setDepth(overheadDepth(0));
    if (npcBox && npcPropId) {
      const id = npcPropId;
      const box = npcBox;
      box.setInteractive({ useHandCursor: true });
      label.setPosition(box.x, box.y + box.height / 2 + 14);
      let inRange = false;
      box.on('pointerdown', () => {
        inRange = !inRange;
        appEvents.emit('npc:proximity', { npcId: id, inRange });
      });
    }

    const spawn =
      this.definition.spawns.find((s) => s.id === 'player') ??
      this.definition.spawns[0];
    if (!spawn) throw new Error('The plaza map needs a "player" spawn');
    this.player = new Player(this, spawn.position, spawn.level);
    this.cameras.main.startFollow(this.player.body, true, 0.15, 0.15);
    this.marker = this.add
      .circle(0, 0, 6)
      .setStrokeStyle(2, INK)
      .setVisible(false)
      .setDepth(DEPTH_DEBUG);
    this.debug = this.add.graphics().setDepth(DEPTH_DEBUG);
    this.debugText = this.add
      .text(8, 8, '', { color: '#d23b3b', fontSize: '14px' })
      .setScrollFactor(0)
      .setDepth(DEPTH_DEBUG)
      .setVisible(false);

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
      this.debugText.setVisible(this.debugOn);
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
        const grid = this.world.grids[0];
        const goalCell = worldToCell(grid, pointer.worldX, pointer.worldY);
        const goalLevel = levelAtCell(this.world, goalCell, this.player.level);
        if (goalLevel === null) return;
        const startCell = worldToCell(
          grid,
          this.player.position.x,
          this.player.position.y,
        );
        const cells = findLevelPath(
          this.world,
          { ...startCell, level: this.player.level },
          { ...goalCell, level: goalLevel },
        );
        if (!cells) return;
        this.path = cells.map((cell) => cellToWorld(grid, cell));
        const target = cellToWorld(grid, goalCell);
        this.marker.setPosition(target.x, target.y).setVisible(true);
      },
    );

    const render = (state: ReturnType<typeof useGameStore.getState>) => {
      npcBox?.setFillStyle(
        npcPropId && state.npcsInRange.includes(npcPropId) ? HIGHLIGHT : PAPER,
      );
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

  /** Level ground, bridge decks and the stair treads. Lower levels draw first. */
  private drawGround() {
    for (const r of this.definition.regions) {
      const { x, y, w, h } = r.rect;
      if (r.elevated) {
        this.drawDeck(r.level, r.rect);
        continue;
      }
      this.add
        .rectangle(x + w / 2, y + h / 2, w, h, r.level === 0 ? PAPER : TERRACE)
        .setStrokeStyle(2, INK)
        .setDepth(GROUND_DEPTH + r.level);
    }
    for (const s of this.definition.stairs) {
      const { x, y, w, h } = s.rect;
      this.add
        .rectangle(x + w / 2, y + h / 2, w, h, STAIRS)
        .setStrokeStyle(2, INK)
        .setDepth(DEPTH_STAIRS);
      const treads = this.add.graphics().setDepth(DEPTH_STAIRS + 1);
      treads.lineStyle(1, INK, 0.6);
      const vertical = s.highEdge === 'n' || s.highEdge === 's';
      for (let t = 16; t < (vertical ? h : w); t += 16) {
        if (vertical) treads.lineBetween(x, y + t, x + w, y + t);
        else treads.lineBetween(x + t, y, x + t, y + h);
      }
    }
  }

  /**
   * A bridge deck: drawn over the level below, so a learner walking underneath is covered,
   * and under the level it carries. It has rails along its long sides and no outline at the
   * ends, so it joins the ground it connects to. The fill reaches 2px past each end to hide
   * that ground's edge line.
   */
  private drawDeck(
    level: number,
    rect: { x: number; y: number; w: number; h: number },
  ) {
    const { x, y, w, h } = rect;
    const lengthwiseY = h >= w;
    const bleed = 2;
    const deck = lengthwiseY
      ? { x, y: y - bleed, w, h: h + 2 * bleed }
      : { x: x - bleed, y, w: w + 2 * bleed, h };
    this.add
      .rectangle(
        deck.x + deck.w / 2,
        deck.y + deck.h / 2,
        deck.w,
        deck.h,
        TERRACE,
      )
      .setAlpha(0.95)
      .setDepth(deckDepth(level));
    const rails = this.add.graphics().setDepth(deckDepth(level) + 1);
    rails.lineStyle(3, INK, 1);
    if (lengthwiseY) {
      rails.lineBetween(x, y, x, y + h);
      rails.lineBetween(x + w, y, x + w, y + h);
    } else {
      rails.lineBetween(x, y, x + w, y);
      rails.lineBetween(x, y + h, x + w, y + h);
    }
  }

  update(_time: number, delta: number) {
    // Cap the step so a stalled frame (tab switch) cannot teleport the player through walls.
    const dt = Math.min(delta, 50) / 1000;
    const input = this.readInput();
    const grid = this.world.grids[this.player.level];

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
    // Stairs change the level; everywhere else it stays as it was.
    this.player.setLevel(
      resolveLevel(this.world.stairs, this.player.level, this.player.position),
    );

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
    const grid = this.world.grids[this.player.level];
    const cell = grid.cellSize;

    // Cells the player's level blocks.
    g.fillStyle(DEBUG, 0.15);
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (!grid.walkable[row * grid.cols + col]) {
          g.fillRect(
            grid.originX + col * cell,
            grid.originY + row * cell,
            cell,
            cell,
          );
        }
      }
    }

    // Footprints (the collision boxes) and stair zones, on every level.
    g.lineStyle(1, DEBUG, 1);
    for (const f of this.definition.footprints) {
      g.strokeRect(f.rect.x, f.rect.y, f.rect.w, f.rect.h);
    }
    g.lineStyle(2, DEBUG_REGION, 1);
    for (const r of this.definition.regions) {
      if (r.level === this.player.level) {
        g.strokeRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
      }
    }
    g.lineStyle(2, 0x2e7d32, 1);
    for (const s of this.definition.stairs) {
      g.strokeRect(s.rect.x, s.rect.y, s.rect.w, s.rect.h);
    }

    g.lineStyle(2, DEBUG, 1);
    let from = this.player.position;
    for (const point of this.path) {
      g.lineBetween(from.x, from.y, point.x, point.y);
      from = point;
    }

    const { x, y } = this.player.position;
    g.lineStyle(1, DEBUG, 1);
    g.strokeRect(
      x - PLAYER_FOOTPRINT.halfW,
      y - PLAYER_FOOTPRINT.halfH,
      PLAYER_FOOTPRINT.halfW * 2,
      PLAYER_FOOTPRINT.halfH * 2,
    );
    this.debugText.setText(
      `level ${this.player.level}  (${Math.round(x)}, ${Math.round(y)})`,
    );
  }
}
