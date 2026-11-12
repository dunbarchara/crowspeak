import type { Rect, Vec2 } from './geometry';
import {
  type FootprintObject,
  type LevelWorld,
  type Region,
  type StairZone,
  type Edge,
  buildLevelWorld,
} from './levels';

/** The subset of Tiled's JSON map format this loader reads. */
export interface TiledProperty {
  name: string;
  type?: string;
  value: unknown;
}
export interface TiledObject {
  id: number;
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  point?: boolean;
  properties?: TiledProperty[];
}
export interface TiledLayer {
  type: string;
  name: string;
  objects?: TiledObject[];
}
export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
}

/** A walkable region. `elevated` ones (bridge decks) draw over the levels below them. */
export interface RegionDef extends Region {
  id: string;
  elevated: boolean;
}

/** A visible object. `footprint` names the collision box that sorts it. */
export interface Prop {
  id: string;
  kind: string;
  level: number;
  rect: Rect;
  footprint?: string;
  npcId?: string;
}

export interface Overhead {
  id: string;
  kind: string;
  level: number;
  rect: Rect;
}

export interface Spawn {
  id: string;
  level: number;
  position: Vec2;
}

/** Everything the plaza needs from a map, with no Phaser types. */
export interface WorldDefinition {
  cols: number;
  rows: number;
  cellSize: number;
  regions: RegionDef[];
  footprints: FootprintObject[];
  stairs: StairZone[];
  props: Prop[];
  overhead: Overhead[];
  spawns: Spawn[];
}

const EDGES: Edge[] = ['n', 's', 'e', 'w'];

/**
 * Read a Tiled JSON export. Layers (all object layers): `regions`, `footprints`, `stairs`,
 * `props`, `overhead` and `spawns`. Throws a descriptive error on anything missing or odd.
 */
export function parseTiledWorld(map: TiledMap): WorldDefinition {
  if (map.tilewidth !== map.tileheight) {
    throw new Error('Map tiles must be square');
  }
  const objects = (layer: string): TiledObject[] => {
    const found = map.layers.find(
      (l) => l.name === layer && l.type === 'objectgroup',
    );
    if (!found) throw new Error(`Map is missing the "${layer}" object layer`);
    return found.objects ?? [];
  };
  const idOf = (layer: string, o: TiledObject) => o.name || `${layer}-${o.id}`;
  const rectOf = (layer: string, o: TiledObject): Rect => {
    if (!o.width || !o.height) {
      throw new Error(`${layer} object ${idOf(layer, o)} needs a size`);
    }
    return { x: o.x, y: o.y, w: o.width, h: o.height };
  };
  const prop = (layer: string, o: TiledObject, name: string) =>
    o.properties?.find((p) => p.name === name)?.value ??
    (() => {
      throw new Error(`${layer} object ${idOf(layer, o)} needs "${name}"`);
    })();
  const optional = (o: TiledObject, name: string) =>
    o.properties?.find((p) => p.name === name)?.value;
  const num = (layer: string, o: TiledObject, name: string): number => {
    const value = prop(layer, o, name);
    if (typeof value !== 'number') {
      throw new Error(
        `${layer} object ${idOf(layer, o)}: "${name}" must be a number`,
      );
    }
    return value;
  };
  const str = (layer: string, o: TiledObject, name: string): string => {
    const value = prop(layer, o, name);
    if (typeof value !== 'string') {
      throw new Error(
        `${layer} object ${idOf(layer, o)}: "${name}" must be text`,
      );
    }
    return value;
  };

  const regions = objects('regions').map((o): RegionDef => ({
    id: idOf('regions', o),
    level: num('regions', o, 'level'),
    rect: rectOf('regions', o),
    elevated: optional(o, 'elevated') === true,
  }));
  const footprints = objects('footprints').map((o) => ({
    id: idOf('footprints', o),
    level: num('footprints', o, 'level'),
    rect: rectOf('footprints', o),
  }));
  const stairs = objects('stairs').map((o): StairZone => {
    const highEdge = str('stairs', o, 'highEdge') as Edge;
    if (!EDGES.includes(highEdge)) {
      throw new Error(`stairs object ${idOf('stairs', o)}: bad highEdge`);
    }
    return {
      id: idOf('stairs', o),
      rect: rectOf('stairs', o),
      low: num('stairs', o, 'low'),
      high: num('stairs', o, 'high'),
      highEdge,
    };
  });
  const props = objects('props').map((o): Prop => {
    const footprint = optional(o, 'footprint');
    const npcId = optional(o, 'npc');
    return {
      id: idOf('props', o),
      kind: str('props', o, 'kind'),
      level: num('props', o, 'level'),
      rect: rectOf('props', o),
      ...(typeof footprint === 'string' ? { footprint } : {}),
      ...(typeof npcId === 'string' ? { npcId } : {}),
    };
  });
  for (const p of props) {
    if (p.footprint && !footprints.some((f) => f.id === p.footprint)) {
      throw new Error(`Prop ${p.id} names unknown footprint ${p.footprint}`);
    }
  }
  const overhead = objects('overhead').map((o) => ({
    id: idOf('overhead', o),
    kind: str('overhead', o, 'kind'),
    level: num('overhead', o, 'level'),
    rect: rectOf('overhead', o),
  }));
  const spawns = objects('spawns').map((o) => ({
    id: idOf('spawns', o),
    level: num('spawns', o, 'level'),
    position: { x: o.x, y: o.y },
  }));

  return {
    cols: map.width,
    rows: map.height,
    cellSize: map.tilewidth,
    regions,
    footprints,
    stairs,
    props,
    overhead,
    spawns,
  };
}

/** Build the collision grids for a parsed world. World space starts at the map's top-left. */
export function toLevelWorld(def: WorldDefinition): LevelWorld {
  return buildLevelWorld(
    def.cols,
    def.rows,
    def.cellSize,
    { x: 0, y: 0 },
    def.regions,
    def.footprints,
    def.stairs,
  );
}
