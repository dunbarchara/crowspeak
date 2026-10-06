import { useEffect, useMemo } from 'react';
import type { HeightFn, TerrainParams } from '../lib/terrain';
import { buildPlanetGeometry } from './buildPlanetGeometry';

type PlanetProps = {
  heightFn: HeightFn;
  params: TerrainParams;
};

export function Planet({ heightFn, params }: PlanetProps) {
  const geometry = useMemo(
    () => buildPlanetGeometry(heightFn, params),
    [heightFn, params],
  );

  // R3F doesn't dispose geometry passed through <primitive>
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial vertexColors flatShading />
    </mesh>
  );
}
