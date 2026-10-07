import { createNoise3D } from 'simplex-noise';

export type TerrainParams = {
  seed: number;
  radius: number; // base planet radius
  amplitude: number; // max hill height, as a fraction of radius
  frequency: number; // how many hills fit around the planet
  octaves: number;
};

// surface radius in the direction (x, y, z), which must be a unit vector
export type HeightFn = (x: number, y: number, z: number) => number;

// simplex-noise takes a func returning [0,1)
// seeded PRNG makes planet identical on every load, as opposed to Math.random
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createHeightFn(p: TerrainParams): HeightFn {
  const noise3D = createNoise3D(mulberry32(p.seed));

  // dir must be unit vector. Returns surface radius in that direction
  return (x: number, y: number, z: number) => {
    let sum = 0;
    let amp = 1;
    let freq = p.frequency;
    let norm = 0;
    for (let i = 0; i < p.octaves; i++) {
      sum += amp * noise3D(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return p.radius * (1 + p.amplitude * (sum / norm));
  };
}

export function colorForHeight(t: number): string {
  // t is height above the base radius, normalized to about -1..1
  if (t < -0.2) return '#e8d9a0'; // sand
  if (t < 0.35) return '#6fbf5a'; // grass
  if (t < 0.6) return '#8a8a8a'; // rock
  return '#f4f4f4'; // snow
}
