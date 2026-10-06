import { useMemo } from 'react';
import { useControls } from 'leva';
import { createHeightFn } from '../lib/terrain';
import { DEFAULT_TERRAIN } from './constants';

// Terrain params (tunable with the leva panel) and the height function built
// from them. Both are memoized, so they only change when a slider moves.
export function useTerrain() {
  const { seed, radius, amplitude, frequency, octaves } = useControls(
    'terrain',
    {
      seed: { value: DEFAULT_TERRAIN.seed, step: 1 },
      radius: DEFAULT_TERRAIN.radius,
      amplitude: {
        value: DEFAULT_TERRAIN.amplitude,
        min: 0,
        max: 0.4,
        step: 0.01,
      },
      frequency: {
        value: DEFAULT_TERRAIN.frequency,
        min: 0.3,
        max: 4,
        step: 0.05,
      },
      octaves: { value: DEFAULT_TERRAIN.octaves, min: 1, max: 6, step: 1 },
    },
  );

  const params = useMemo(
    () => ({ seed, radius, amplitude, frequency, octaves }),
    [seed, radius, amplitude, frequency, octaves],
  );
  const heightFn = useMemo(() => createHeightFn(params), [params]);

  return { params, heightFn };
}
