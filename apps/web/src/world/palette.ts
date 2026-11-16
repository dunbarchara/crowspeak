import { readColor } from '../hud/cssVars';

/** The world's colors: the HUD's own tokens (index.css), so the two always match. */
export interface Palette {
  /** Ground, and the chat window's background. */
  bg: number;
  /** Raised ground (terraces, decks, stairs). */
  bg2: number;
  /** Solid masses (buildings, pillars). */
  bg3: number;
  /** Outlines and the player. */
  line: number;
  /** Fine detail inside a shape (stair treads). */
  hairline: number;
  /** Shaded faces (cliffs). */
  muted: number;
  /** The one accent: the highlighted NPC. */
  yellow: number;
}

export function readPalette(root: Element = document.documentElement): Palette {
  return {
    bg: readColor(root, '--bg', 0xffffff),
    bg2: readColor(root, '--bg-2', 0xf2f2f2),
    bg3: readColor(root, '--bg-3', 0xe6e6e6),
    line: readColor(root, '--line', 0x000000),
    hairline: readColor(root, '--hairline', 0xcfcfcf),
    muted: readColor(root, '--muted', 0x5a5a5a),
    yellow: readColor(root, '--yellow-text', 0x8a5d00),
  };
}

/** `#rrggbb` for a color number, for Phaser text styles and the canvas background. */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * Keeps the world's shapes in step with the theme. Each object registers a function that
 * paints it from a palette; when the theme changes (the HUD toggle sets `data-theme`, or the
 * system flips `prefers-color-scheme`) every function runs again.
 */
export class Themer {
  palette = readPalette();
  private readonly painters: Array<(p: Palette) => void> = [];
  private readonly stop: () => void;

  constructor(onChange?: (p: Palette) => void) {
    const refresh = () => {
      this.palette = readPalette();
      for (const paint of this.painters) paint(this.palette);
      onChange?.(this.palette);
    };
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', refresh);
    this.stop = () => {
      observer.disconnect();
      media.removeEventListener('change', refresh);
    };
  }

  /** Paint now, and again whenever the theme changes. */
  bind(paint: (p: Palette) => void): void {
    this.painters.push(paint);
    paint(this.palette);
  }

  destroy(): void {
    this.stop();
    this.painters.length = 0;
  }
}
