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
import {
  type ConversationTarget,
  ENTER_RADIUS,
  EXIT_RADIUS,
  pickTarget,
  sameTarget,
} from '../lib/proximity';
import type { WorldDefinition } from '../lib/world';
import type { LoadedWorld } from '../lib/worldLoader';
import { appEvents } from '../store/channel';
import { useGameStore } from '../store/useGameStore';
import { followOffsetForInset, type ViewInset } from '../lib/viewInset';
import { Npc } from './Npc';
import { type Palette, Themer, cssColor } from './palette';
import { PLAYER_FOOTPRINT, Player } from './Player';
import { screenAnchors } from './screenAnchors';
import { virtualStick } from './virtualStick';

const DEBUG = 0xd23b3b;
const FONT = "'gg sans', 'Segoe UI', system-ui, sans-serif";

const SPEED = 160; // world pixels per second

/** Flat layers, all below every entity. Entity, deck and overhead depths come from `lib/depth`. */
const DEPTH_STAIRS = GROUND_DEPTH + 500;
const DEPTH_DECOR = GROUND_DEPTH + 1_000; // flat decoration such as cliff faces
const DEPTH_DEBUG = 100_000;
const DEBUG_REGION = 0x1565c0;

/**
 * Fill by prop kind, as a palette key. Like the HUD it is flat black and white: ground is the
 * page color, and each step of grey is something standing on it. Outlines are always 1px.
 */
type Fill = 'bg' | 'bg2' | 'bg3' | 'muted';
const FILL: Record<string, Fill> = {
  building: 'bg3',
  pillar: 'bg3',
  'arch-top': 'bg3',
  cliff: 'muted',
  fountain: 'bg',
};
const FLAT_KINDS = new Set(['cliff']);

/**
 * The town plaza, built from a loaded world (`lib/worldLoader`, passed in as scene data): two
 * elevation levels joined by stairs, a bridge, buildings, a fountain, an arch to walk through,
 * and NPCs standing at the world's anchors.
 * - Movement: WASD or arrow keys, a virtual stick on touch devices, or click/tap to walk there.
 *   NPCs have no collision with the learner: they can walk through each other.
 * - Proximity: every frame the nearest NPC in range on the player's level is the conversation
 *   target; if it belongs to a predefined group, the whole group is. Targets get a highlighted
 *   shadow and are published as `target:changed` on the channel.
 * - Press G to toggle the debug overlay (footprints, stairs, blocked cells, path, level, ranges).
 */
export class PlazaScene extends Phaser.Scene {
  private definition!: WorldDefinition;
  private world!: LevelWorld;
  private themer!: Themer;
  private footprintBottom = new Map<string, number>();
  private player!: Player;
  private npcs: Npc[] = [];
  private target: ConversationTarget | null = null;
  private followOffset = { x: 0, y: 0 };
  private insetTween?: Phaser.Tweens.Tween;
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

  /**
   * A 1px outlined box covering exactly `rect`. Phaser centers a stroke on the edge, so the
   * shape is pulled in by half a pixel: the line then fills one row of device-independent
   * pixels instead of blurring across two.
   */
  private box(
    rect: { x: number; y: number; w: number; h: number },
    fill: (p: Palette) => number,
    depth: number,
  ) {
    const { x, y, w, h } = rect;
    const shape = this.add
      .rectangle(x + w / 2, y + h / 2, w - 1, h - 1)
      .setDepth(depth);
    this.themer.bind((p) =>
      shape.setFillStyle(fill(p)).setStrokeStyle(1, p.line),
    );
    return shape;
  }

  create() {
    const dpr = 1 / this.scale.zoom;
    this.cameras.main.setZoom(dpr);
    this.themer = new Themer((p) =>
      this.cameras.main.setBackgroundColor(cssColor(p.bg)),
    );
    this.cameras.main.setBackgroundColor(cssColor(this.themer.palette.bg));
    this.drawGround();

    for (const p of this.definition.props) {
      const { y, h } = p.rect;
      const key = FILL[p.kind] ?? 'bg3';
      // Flat things sit on the ground. Others sort by the footprint's bottom edge, like the
      // player's feet, so walking in front of or behind an object works whatever its sprite
      // looks like.
      const depth = FLAT_KINDS.has(p.kind)
        ? DEPTH_DECOR
        : entityDepth(
            p.level,
            this.footprintBottom.get(p.footprint ?? '') ?? y + h,
          );
      this.box(p.rect, (pal) => pal[key], depth);
    }
    for (const o of this.definition.overhead) {
      const key = FILL[o.kind] ?? 'bg3';
      this.box(o.rect, (pal) => pal[key], overheadDepth(o.level));
    }

    this.npcs = this.definition.npcAnchors.map(
      (a) => new Npc(this, this.themer, a),
    );

    const spawn =
      this.definition.spawns.find((s) => s.id === 'player') ??
      this.definition.spawns[0];
    if (!spawn) throw new Error('The plaza map needs a "player" spawn');
    this.player = new Player(this, this.themer, spawn.position, spawn.level);
    this.cameras.main.startFollow(this.player.body, true, 0.15, 0.15);
    this.marker = this.add
      .circle(0, 0, 6)
      .setVisible(false)
      .setDepth(DEPTH_DEBUG);
    this.themer.bind((p) => this.marker.setStrokeStyle(1, p.line));
    this.debug = this.add.graphics().setDepth(DEPTH_DEBUG);
    this.debugText = this.add
      .text(8, 8, '', {
        color: '#d23b3b',
        fontFamily: FONT,
        fontSize: '14px',
        resolution: dpr,
      })
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

    // Click or tap to walk. Presses on interactive objects are not movement.
    this.input.on(
      'pointerdown',
      (
        pointer: Phaser.Input.Pointer,
        over: Phaser.GameObjects.GameObject[],
      ) => {
        // Clicking the world leaves the conversation, and the click still walks somewhere.
        useGameStore.getState().endConversation();
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

    // While the chat input has focus, the world must not read (or swallow) the keyboard, or
    // typing "w" would walk the player. Phaser's key captures are global, so lift them too.
    const setKeyboardActive = (active: boolean) => {
      keyboard.enabled = active;
      if (active) keyboard.enableGlobalCapture();
      else {
        keyboard.disableGlobalCapture();
        keyboard.resetKeys();
      }
    };
    let chatFocused = useGameStore.getState().chatFocused;
    let inset = useGameStore.getState().viewInset;
    setKeyboardActive(!chatFocused);
    this.applyInset(inset, true);
    const unsubscribeStore = useGameStore.subscribe((state) => {
      if (state.chatFocused !== chatFocused) {
        chatFocused = state.chatFocused;
        setKeyboardActive(!chatFocused);
      }
      if (state.viewInset !== inset) {
        inset = state.viewInset;
        this.applyInset(inset, false);
      }
    });

    // E starts a conversation with whoever is in range; Escape ends it. Adding the keys also
    // captures them, so the "e" is not typed into the chat input that opens in response.
    const interact = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    interact.on('down', () => useGameStore.getState().startConversation());
    const leave = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    leave.on('down', () => useGameStore.getState().endConversation());

    // Tell the HUD where speech bubbles go. After rendering, the camera and the sprites agree.
    this.game.events.on(
      Phaser.Core.Events.POST_RENDER,
      this.publishAnchors,
      this,
    );

    // `game.destroy()` emits DESTROY, not SHUTDOWN, so listen for both. A scene that goes
    // away must not leave its last target in the store, or a leaked listener behind.
    const cleanup = () => {
      unsubscribeStore();
      this.themer.destroy();
      this.game?.events.off(
        Phaser.Core.Events.POST_RENDER,
        this.publishAnchors,
        this,
      );
      screenAnchors.clear();
      appEvents.emit('target:changed', { target: null });
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  /** Level ground, bridge decks and the stair treads. Lower levels draw first. */
  private drawGround() {
    for (const r of this.definition.regions) {
      if (r.elevated) {
        this.drawDeck(r.level, r.rect);
        continue;
      }
      // The lowest level is the page color, the same as the chat; each level up is a step darker.
      this.box(
        r.rect,
        (p) => (r.level === 0 ? p.bg : p.bg2),
        GROUND_DEPTH + r.level,
      );
    }
    for (const s of this.definition.stairs) {
      const { x, y, w, h } = s.rect;
      this.box(s.rect, (p) => p.bg2, DEPTH_STAIRS);
      const treads = this.add.graphics().setDepth(DEPTH_STAIRS + 1);
      const vertical = s.highEdge === 'n' || s.highEdge === 's';
      // Treads are 1px lines on the pixel grid (+0.5), in the HUD's hairline grey.
      this.themer.bind((p) => {
        treads.clear().lineStyle(1, p.hairline, 1);
        for (let t = 16; t < (vertical ? h : w); t += 16) {
          if (vertical)
            treads.lineBetween(x + 1, y + t + 0.5, x + w - 1, y + t + 0.5);
          else treads.lineBetween(x + t + 0.5, y + 1, x + t + 0.5, y + h - 1);
        }
      });
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
    const fill = this.add
      .rectangle(deck.x + deck.w / 2, deck.y + deck.h / 2, deck.w, deck.h)
      .setDepth(deckDepth(level));
    const rails = this.add.graphics().setDepth(deckDepth(level) + 1);
    this.themer.bind((p) => {
      fill.setFillStyle(p.bg2);
      rails.clear().lineStyle(1, p.line, 1);
      // Rails sit just inside the deck's edge, on whole pixels.
      if (lengthwiseY) {
        rails.lineBetween(x + 0.5, y, x + 0.5, y + h);
        rails.lineBetween(x + w - 0.5, y, x + w - 0.5, y + h);
      } else {
        rails.lineBetween(x, y + 0.5, x + w, y + 0.5);
        rails.lineBetween(x, y + h - 0.5, x + w, y + h - 0.5);
      }
    });
  }

  update(_time: number, delta: number) {
    // Cap the step so a stalled frame (tab switch) cannot teleport the player through walls.
    const dt = Math.min(delta, 50) / 1000;
    const input = this.readInput();
    const grid = this.world.grids[this.player.level];

    if (input.x !== 0 || input.y !== 0) {
      // Walking somewhere else leaves the conversation. (Typing in the chat never gets here:
      // the keyboard is off while the input has focus.)
      if (useGameStore.getState().conversation) {
        useGameStore.getState().endConversation();
      }
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

    this.updateTarget();
    if (this.debugOn) this.drawDebug();
  }

  /**
   * Slide the camera so the player sits in the middle of the screen that the HUD leaves free
   * (for example to the right of the chat). `instant` skips the animation, for the first frame.
   */
  private applyInset(inset: ViewInset, instant: boolean) {
    const cam = this.cameras.main;
    // The inset and the offset are in CSS pixels, which equal world units at the camera's
    // base scale; the canvas itself is `zoom` times bigger than its CSS box.
    const goal = followOffsetForInset(inset, 1, undefined, {
      width: cam.width / cam.zoom,
      height: cam.height / cam.zoom,
    });
    this.insetTween?.stop();
    const apply = () =>
      cam.setFollowOffset(this.followOffset.x, this.followOffset.y);
    if (instant) {
      this.followOffset = goal;
      apply();
      return;
    }
    this.insetTween = this.tweens.add({
      targets: this.followOffset,
      x: goal.x,
      y: goal.y,
      duration: 350,
      ease: 'Sine.easeInOut',
      onUpdate: apply,
    });
  }

  /** Where each NPC's head and the player's head are on screen, for speech bubbles. */
  private publishAnchors() {
    const cam = this.cameras.main;
    // World units are CSS pixels (the camera zoom is the pixel ratio), so no scaling needed.
    const head = (x: number, y: number) => ({
      x: x - cam.worldView.x,
      y: y - cam.worldView.y,
    });
    for (const npc of this.npcs) {
      screenAnchors.set(npc.npcId, head(npc.position.x, npc.position.y - 44));
    }
    const { x, y } = this.player.position;
    screenAnchors.set('player', head(x, y - 40));
  }

  /** Recompute who the learner would talk to; on a change, highlight them and tell the app. */
  private updateTarget() {
    const next = pickTarget(this.player, this.npcs, this.target);
    if (sameTarget(next, this.target)) return;
    this.target = next;
    for (const npc of this.npcs) {
      npc.setHighlighted(next?.npcIds.includes(npc.npcId) ?? false);
    }
    appEvents.emit('target:changed', { target: next });
  }

  private readInput(): Vec2 {
    // Typing in the chat must never walk the player, whatever Phaser thinks the keys are doing.
    // The stick is separate: it is a touch control, not a key.
    const typing = useGameStore.getState().chatFocused;
    const { cursors, wasd } = this;
    if (typing) return { x: virtualStick.x, y: virtualStick.y };
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

    // The enter and exit radii around the NPCs on the player's level.
    for (const npc of this.npcs) {
      if (npc.level !== this.player.level) continue;
      g.lineStyle(1, 0xe5a50a, 1);
      g.strokeCircle(npc.position.x, npc.position.y, ENTER_RADIUS);
      g.lineStyle(1, 0xe5a50a, 0.4);
      g.strokeCircle(npc.position.x, npc.position.y, EXIT_RADIUS);
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
      `level ${this.player.level}  (${Math.round(x)}, ${Math.round(y)})  target: ${
        this.target ? this.target.npcIds.join('+') : 'none'
      }`,
    );
  }
}
