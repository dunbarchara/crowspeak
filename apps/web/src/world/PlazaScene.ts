import Phaser from 'phaser';
import { appEvents } from '../store/channel';
import { useGameStore } from '../store/useGameStore';

const INK = 0x222222;
const PAPER = 0xf4f1ea;
const HIGHLIGHT = 0xe5a50a;

/**
 * Placeholder scene that proves the wiring in both directions:
 * - store -> Phaser: the label follows `voiceEnabled`, the NPC square follows `npcsInRange`.
 * - Phaser -> store: clicking the square emits `npc:proximity` on the channel.
 * Replaced by the real plaza in later steps.
 */
export class PlazaScene extends Phaser.Scene {
  constructor() {
    super('plaza');
  }

  create() {
    const npcId = 'npc-demo';
    const npc = this.add
      .rectangle(0, 0, 64, 64, PAPER)
      .setStrokeStyle(3, INK)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(0, 60, '', { color: '#222222', fontSize: '16px' })
      .setOrigin(0.5);

    let inRange = false;
    npc.on('pointerdown', () => {
      inRange = !inRange;
      appEvents.emit('npc:proximity', { npcId, inRange });
    });

    const render = (state: ReturnType<typeof useGameStore.getState>) => {
      npc.setFillStyle(state.npcsInRange.includes(npcId) ? HIGHLIGHT : PAPER);
      label.setText(
        `voice: ${state.voiceEnabled ? 'on' : 'off'} (click the square)`,
      );
    };
    render(useGameStore.getState());
    const unsubscribe = useGameStore.subscribe(render);

    const center = () => this.cameras.main.centerOn(0, 0);
    center();
    this.scale.on('resize', center);

    // `game.destroy()` emits DESTROY, not SHUTDOWN, so listen for both. A leaked store
    // subscription from a destroyed scene throws on its dead objects and breaks live scenes.
    const cleanup = () => {
      unsubscribe();
      this.scale.off('resize', center);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }
}
