import { BufferAttribute, Color, IcosahedronGeometry } from 'three';
import {
  colorForHeight,
  type HeightFn,
  type TerrainParams,
} from '../lib/terrain';
import { PLANET_DETAIL } from './constants';

// Unit icosphere pushed out to the terrain surface, with one color per triangle.
export function buildPlanetGeometry(heightFn: HeightFn, params: TerrainParams) {
  const geo = new IcosahedronGeometry(1, PLANET_DETAIL);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const h = heightFn(x, y, z);
    pos.setXYZ(i, x * h, y * h, z * h);
  }

  geo.computeVertexNormals();

  const radiusAt = (i: number) =>
    Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));

  const colors = new Float32Array(pos.count * 3);
  const color = new Color();

  // non-indexed geometry: every 3 consecutive vertices form one triangle
  for (let i = 0; i < pos.count; i += 3) {
    // avg the 3 vertices of this triangle so the whole face gets one color
    const normalizedHeight =
      ((radiusAt(i) + radiusAt(i + 1) + radiusAt(i + 2)) / 3 - params.radius) /
      (params.radius * params.amplitude);
    color.set(colorForHeight(normalizedHeight));
    for (let k = 0; k < 3; k++) color.toArray(colors, (i + k) * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));

  return geo;
}
