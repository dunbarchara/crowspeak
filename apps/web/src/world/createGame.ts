import Phaser from 'phaser';
import type { LoadedWorld } from '../lib/worldLoader';
import { PlazaScene } from './PlazaScene';

const pixelRatio = () => Math.max(1, window.devicePixelRatio || 1);

/**
 * Phaser sizes its canvas in CSS pixels and knows nothing about `devicePixelRatio`, so on a
 * HiDPI screen the browser stretches that canvas up and every line comes out soft. To fix it,
 * the canvas is made `dpr` times bigger than its box (the scale manager's zoom of `1 / dpr`
 * shrinks it back on the page) and the camera zooms by `dpr`, so one world unit stays one CSS
 * pixel. That keeps the HUD's coordinates (insets, speech bubble anchors) in the same units.
 */
export function createGame(
  parent: HTMLElement,
  world: LoadedWorld,
): Phaser.Game {
  const dpr = pixelRatio();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    // The ground color, so nothing flashes before the scene paints. The scene keeps it in step
    // with the theme.
    backgroundColor: getComputedStyle(document.documentElement)
      .getPropertyValue('--bg')
      .trim(),
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.max(1, Math.round(parent.clientWidth * dpr)),
      height: Math.max(1, Math.round(parent.clientHeight * dpr)),
      zoom: 1 / dpr,
    },
    // Whole-pixel placement keeps 1px outlines from straddling two device pixels.
    render: { roundPixels: true },
    scene: [],
  });

  // NONE does not follow the parent, so do it here, and follow a changed pixel ratio (browser
  // zoom, or a window moved to another screen) too.
  const fit = () => {
    const ratio = pixelRatio();
    game.scale.setZoom(1 / ratio);
    game.scale.resize(
      Math.max(1, Math.round(parent.clientWidth * ratio)),
      Math.max(1, Math.round(parent.clientHeight * ratio)),
    );
    game.scene.getScene('plaza')?.cameras.main.setZoom(ratio);
  };
  const resizeObserver = new ResizeObserver(fit);
  resizeObserver.observe(parent);
  // A resolution media query only matches one ratio, so watch for it to stop matching.
  let media: MediaQueryList;
  const watchRatio = () => {
    media?.removeEventListener('change', onRatio);
    media = matchMedia(`(resolution: ${pixelRatio()}dppx)`);
    media.addEventListener('change', onRatio);
  };
  const onRatio = () => {
    fit();
    watchRatio();
  };
  watchRatio();
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    resizeObserver.disconnect();
    media.removeEventListener('change', onRatio);
  });

  // Added before boot, Phaser queues the scene and starts it with this data once ready.
  game.scene.add('plaza', PlazaScene, true, { world });
  return game;
}
