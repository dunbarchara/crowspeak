import type { TerrainParams } from '../lib/terrain';

export const DEFAULT_TERRAIN: TerrainParams = {
  seed: 1,
  radius: 10,
  amplitude: 0.12,
  frequency: 1.2,
  octaves: 3,
};

// icosphere subdivisions: higher = more terrain resolution (~20 * (n + 1)^2 triangles)
export const PLANET_DETAIL = 32;

export const SKY_TOP_COLOR = '#6aa9f0';
export const SKY_BOTTOM_COLOR = '#f7d9c4';
export const SKY_SCALE = 100;
