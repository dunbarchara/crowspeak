import { type Rect, type Vec2, rectContains } from './geometry';
import { isCellWalkable, worldToCell } from './grid';
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
}

export interface Overhead {
  id: string;
  kind: string;
  level: number;
  rect: Rect;
}

/**
 * Where an engine `npc_id` stands. `position` is the point between the NPC's feet.
 * NPCs that share a `groupId` are a predefined group: approaching any member is approaching all.
 */
export interface NpcAnchor {
  npcId: string;
  level: number;
  position: Vec2;
  groupId: string | null;
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
  npcAnchors: NpcAnchor[];
}

const EDGES: Edge[] = ['n', 's', 'e', 'w'];

function asTiledMap(value: unknown): TiledMap {
  const map = value as Partial<Record<keyof TiledMap, unknown>> | null;
  const numbers = ['width', 'height', 'tilewidth', 'tileheight'] as const;
  if (
    typeof map !== 'object' ||
    map === null ||
    !Array.isArray(map.layers) ||
    numbers.some((key) => typeof map[key] !== 'number')
  ) {
    throw new Error('Not a Tiled JSON map');
  }
  return map as TiledMap;
}

/**
 * Read a Tiled JSON export. Layers (all object layers): `regions`, `footprints`, `stairs`,
 * `props`, `overhead`, `spawns` and `npc-anchors`. Throws a descriptive error on anything
 * missing or odd. The `prefab` property is reserved for reusable buildings and rejected
 * until they are supported, rather than silently ignored.
 */
export function parseTiledWorld(input: unknown): WorldDefinition {
  const map = asTiledMap(input);
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
  for (const layer of map.layers) {
    for (const o of layer.objects ?? []) {
      if (o.properties?.some((p) => p.name === 'prefab')) {
        throw new Error(
          `${layer.name} object ${idOf(layer.name, o)}: prefabs are not supported yet`,
        );
      }
    }
  }
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
    return {
      id: idOf('props', o),
      kind: str('props', o, 'kind'),
      level: num('props', o, 'level'),
      rect: rectOf('props', o),
      ...(typeof footprint === 'string' ? { footprint } : {}),
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

  const npcAnchors = objects('npc-anchors').map((o): NpcAnchor => {
    if (!o.name) throw new Error('npc-anchors objects must be named by npc_id');
    const group = optional(o, 'group');
    if (group !== undefined && (typeof group !== 'string' || !group)) {
      throw new Error(`npc-anchors object ${o.name}: "group" must be text`);
    }
    return {
      npcId: o.name,
      level: num('npc-anchors', o, 'level'),
      position: { x: o.x, y: o.y },
      groupId: group ?? null,
    };
  });
  const seen = new Set<string>();
  for (const a of npcAnchors) {
    if (seen.has(a.npcId)) throw new Error(`Duplicate NPC anchor ${a.npcId}`);
    seen.add(a.npcId);
  }
  const groupSizes = new Map<string, number>();
  for (const a of npcAnchors) {
    if (a.groupId)
      groupSizes.set(a.groupId, (groupSizes.get(a.groupId) ?? 0) + 1);
  }
  for (const [groupId, size] of groupSizes) {
    if (size < 2)
      throw new Error(`NPC group ${groupId} needs at least two members`);
  }

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
    npcAnchors,
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

/**
 * Check that a parsed world makes sense once its grids exist: the player spawn must stand
 * on walkable ground, and every NPC anchor must lie inside a region of its level. (An NPC's
 * own footprint blocks the cells around it, so anchors are not required to be walkable.)
 */
export function validateWorld(def: WorldDefinition, levels: LevelWorld): void {
  for (const spawn of def.spawns) {
    const grid = levels.grids[spawn.level];
    if (!grid) throw new Error(`Spawn ${spawn.id}: no level ${spawn.level}`);
    const cell = worldToCell(grid, spawn.position.x, spawn.position.y);
    if (!isCellWalkable(grid, cell.col, cell.row)) {
      throw new Error(
        `Spawn ${spawn.id} is not on walkable ground on level ${spawn.level}`,
      );
    }
  }
  for (const anchor of def.npcAnchors) {
    const inside = def.regions.some(
      (r) => r.level === anchor.level && rectContains(r.rect, anchor.position),
    );
    if (!inside) {
      throw new Error(
        `NPC anchor ${anchor.npcId} is outside every region of level ${anchor.level}`,
      );
    }
  }
}
