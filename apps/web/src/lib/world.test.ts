import { describe, expect, it } from 'vitest';
import plazaMap from '../../public/worlds/plaza@1/map.json';
import { cellToWorld, isFootprintWalkable, worldToCell } from './grid';
import { rectContains } from './geometry';
import { levelAtCell, resolveLevel } from './levels';
import { findLevelPath } from './pathfinding';
import {
  type TiledMap,
  parseTiledWorld,
  toLevelWorld,
  validateWorld,
} from './world';

const def = parseTiledWorld(plazaMap);
const world = toLevelWorld(def);
const body = { halfW: 10, halfH: 5 }; // the player's footprint
const cellAt = (x: number, y: number) => worldToCell(world.grids[0], x, y);

describe('parseTiledWorld', () => {
  it('reads the plaza map', () => {
    expect(def.cols).toBe(49);
    expect(def.cellSize).toBe(32);
    expect(def.stairs).toHaveLength(1);
    expect(new Set(def.regions.map((r) => r.level))).toEqual(new Set([0, 1]));
    expect(def.spawns.find((s) => s.id === 'player')?.level).toBe(0);
  });

  it('keeps every prop footprint link valid', () => {
    const ids = new Set(def.footprints.map((f) => f.id));
    for (const p of def.props) {
      if (p.footprint) expect(ids.has(p.footprint)).toBe(true);
    }
  });

  it('names the missing layer', () => {
    const broken: TiledMap = {
      ...plazaMap,
      layers: plazaMap.layers.filter((l) => l.name !== 'stairs'),
    };
    expect(() => parseTiledWorld(broken)).toThrow(/"stairs"/);
  });

  it('rejects a prop that names an unknown footprint', () => {
    const layers = plazaMap.layers.map((l) =>
      l.name === 'props'
        ? {
            ...l,
            objects: [
              {
                ...l.objects[0],
                properties: [
                  { name: 'kind', type: 'string', value: 'building' },
                  { name: 'level', type: 'int', value: 0 },
                  { name: 'footprint', type: 'string', value: 'nope' },
                ],
              },
            ],
          }
        : l,
    );
    expect(() => parseTiledWorld({ ...plazaMap, layers })).toThrow(/nope/);
  });
});

describe('the plaza', () => {
  it('puts the player spawn on open ground', () => {
    const spawn = def.spawns.find((s) => s.id === 'player')!;
    expect(
      isFootprintWalkable(
        world.grids[spawn.level],
        spawn.position.x,
        spawn.position.y,
        body,
      ),
    ).toBe(true);
  });

  it('blocks the arch pillars but lets the player through the middle', () => {
    const grid = world.grids[0];
    expect(isFootprintWalkable(grid, 848, 720, body)).toBe(false); // left pillar
    expect(isFootprintWalkable(grid, 944, 720, body)).toBe(false); // right pillar
    expect(isFootprintWalkable(grid, 896, 720, body)).toBe(true); // between them
  });

  it('lets the player walk behind an object: its footprint is only the base', () => {
    const grid = world.grids[0];
    // building-west: sprite y 352..512, footprint y 448..512.
    expect(isFootprintWalkable(grid, 200, 400, body)).toBe(true);
    expect(isFootprintWalkable(grid, 200, 480, body)).toBe(false);
  });

  it('shares each object bottom edge with its footprint for sorting', () => {
    for (const p of def.props) {
      if (!p.footprint) continue;
      const f = def.footprints.find((x) => x.id === p.footprint)!;
      expect(p.rect.y + p.rect.h).toBe(f.rect.y + f.rect.h);
    }
  });

  it('only reaches the terrace through the stairs', () => {
    const spawn = def.spawns.find((s) => s.id === 'player')!;
    const goal = cellAt(300, 100); // on the terrace
    expect(levelAtCell(world, goal, 0)).toBe(1);
    const path = findLevelPath(
      world,
      { ...cellAt(spawn.position.x, spawn.position.y), level: spawn.level },
      { ...goal, level: 1 },
    );
    expect(path).not.toBeNull();
    const stair = def.stairs[0].rect;
    const climb = path!.find((c) => c.level === 1)!;
    const at = cellToWorld(world.grids[0], climb);
    expect(at.x).toBeGreaterThanOrEqual(stair.x);
    expect(at.x).toBeLessThan(stair.x + stair.w);
    // Every step is on ground that level can stand on.
    for (const c of path!) {
      expect(world.grids[c.level].walkable[c.row * def.cols + c.col]).toBe(
        true,
      );
    }
  });

  it('switches level at the middle of the stairs', () => {
    const s = def.stairs[0];
    const mid = s.rect.y + s.rect.h / 2;
    const x = s.rect.x + s.rect.w / 2;
    expect(resolveLevel(world.stairs, 0, { x, y: mid + 4 })).toBe(0);
    expect(resolveLevel(world.stairs, 0, { x, y: mid - 4 })).toBe(1);
  });

  it('walks the whole stair on the correct level grid without getting stuck', () => {
    const s = def.stairs[0];
    const x = s.rect.x + s.rect.w / 2;
    let level = 0;
    for (let y = s.rect.y + s.rect.h - 1; y >= s.rect.y; y -= 2) {
      level = resolveLevel(world.stairs, level, { x, y });
      expect(isFootprintWalkable(world.grids[level], x, y, body)).toBe(true);
    }
    expect(level).toBe(1);
  });
});

describe('the bridge and the L-shaped upper level', () => {
  const bridge = def.regions.find((r) => r.id === 'bridge')!;
  const lower = def.regions.find((r) => r.id === 'lower-plaza')!;
  const southArm = def.regions.find((r) => r.id === 'south-arm')!;
  const mid = {
    x: bridge.rect.x + bridge.rect.w / 2,
    y: 600, // well inside the lower plaza
  };

  it('is an elevated deck that overlaps the lower plaza', () => {
    expect(bridge.elevated).toBe(true);
    expect(bridge.level).toBe(1);
    expect(rectContains(lower.rect, mid)).toBe(true);
    expect(rectContains(bridge.rect, mid)).toBe(true);
  });

  it('does not cross the stair, which would force a level change', () => {
    const stair = def.stairs[0].rect;
    const overlapsX =
      bridge.rect.x < stair.x + stair.w &&
      stair.x < bridge.rect.x + bridge.rect.w;
    expect(overlapsX).toBe(false);
  });

  it('lets a learner walk under the bridge on the lower level', () => {
    expect(isFootprintWalkable(world.grids[0], mid.x, mid.y, body)).toBe(true);
    expect(levelAtCell(world, cellAt(mid.x, mid.y), 0)).toBe(0);
  });

  it('lets a learner walk across the bridge on the upper level', () => {
    for (let y = 230; y < 890; y += 10) {
      expect(isFootprintWalkable(world.grids[1], mid.x, y, body)).toBe(true);
    }
    expect(levelAtCell(world, cellAt(mid.x, mid.y), 1)).toBe(1);
  });

  it('keeps the two layers apart: no stairs, so no level change on the bridge', () => {
    expect(resolveLevel(world.stairs, 1, mid)).toBe(1);
    expect(resolveLevel(world.stairs, 0, mid)).toBe(0);
  });

  it('wraps the L around the east and south of the lower plaza without overlapping it', () => {
    const east = def.regions.find((r) => r.id === 'east-arm')!;
    expect(east.rect.x).toBeGreaterThan(lower.rect.x + lower.rect.w);
    expect(southArm.rect.y).toBeGreaterThanOrEqual(lower.rect.y + lower.rect.h);
    expect(southArm.level).toBe(1);
    expect(east.level).toBe(1);
  });

  it('walks from the terrace to the south arm along the bridge, staying on the upper level', () => {
    const start = { ...cellAt(480, 210), level: 1 }; // terrace, just south of the hall
    const goal = { ...cellAt(480, 1000), level: 1 }; // south arm
    const path = findLevelPath(world, start, goal);
    expect(path).not.toBeNull();
    expect(path!.every((c) => c.level === 1)).toBe(true);
    // It really crosses the lower plaza's rows on the deck.
    const lowerRows = path!.filter((c) => {
      const p = cellToWorld(world.grids[0], c);
      return rectContains(lower.rect, p);
    });
    expect(lowerRows.length).toBeGreaterThan(10);
  });

  it('reaches the south arm from the spawn: up the stairs, across the bridge', () => {
    const spawn = def.spawns.find((s) => s.id === 'player')!;
    const goal = cellAt(1200, 1000);
    expect(levelAtCell(world, goal, 0)).toBe(1);
    const path = findLevelPath(
      world,
      { ...cellAt(spawn.position.x, spawn.position.y), level: 0 },
      { ...goal, level: 1 },
    );
    expect(path).not.toBeNull();
    const climb = path!.findIndex((c) => c.level === 1);
    expect(climb).toBeGreaterThan(0);
    // After the climb it never drops back to the lower level.
    expect(path!.slice(climb).every((c) => c.level === 1)).toBe(true);
  });

  it('cannot reach the upper level except by the stairs or the bridge from above', () => {
    // The east arm is separated from the lower plaza by a drop, not a stair.
    const wall = cellAt(1264, 500);
    expect(world.grids[0].walkable[wall.row * def.cols + wall.col]).toBe(false);
    expect(world.grids[1].walkable[wall.row * def.cols + wall.col]).toBe(false);
  });
});

describe('NPC anchors', () => {
  it('reads them from the npc-anchors layer by npc_id', () => {
    expect(def.npcAnchors).toEqual([
      { npcId: 'npc-demo', level: 0, position: { x: 400, y: 592 } },
    ]);
  });

  const withAnchors = (objects: unknown[]) =>
    ({
      ...plazaMap,
      layers: plazaMap.layers.map((l) =>
        l.name === 'npc-anchors' ? { ...l, objects } : l,
      ),
    }) as unknown as TiledMap;
  const anchor = (name: string | undefined, x = 400, y = 592, level = 0) => ({
    id: 99,
    ...(name ? { name } : {}),
    x,
    y,
    point: true,
    properties: [{ name: 'level', type: 'int', value: level }],
  });

  it('rejects unnamed and duplicate anchors', () => {
    expect(() => parseTiledWorld(withAnchors([anchor(undefined)]))).toThrow(
      /npc_id/,
    );
    expect(() =>
      parseTiledWorld(withAnchors([anchor('a'), anchor('a')])),
    ).toThrow(/Duplicate/);
  });

  it('validates that anchors sit inside a region of their level', () => {
    const outside = parseTiledWorld(withAnchors([anchor('far', 5000, 5000)]));
    expect(() => validateWorld(outside, toLevelWorld(outside))).toThrow(
      /outside every region/,
    );
    const wrongLevel = parseTiledWorld(
      withAnchors([anchor('up', 400, 592, 1)]),
    );
    expect(() => validateWorld(wrongLevel, toLevelWorld(wrongLevel))).toThrow(
      /level 1/,
    );
    expect(() => validateWorld(def, world)).not.toThrow();
  });

  it('rejects a player spawn on blocked ground', () => {
    const blocked = {
      ...def,
      spawns: [{ id: 'player', level: 0, position: { x: 400, y: 560 } }], // inside the NPC
    };
    expect(() => validateWorld(blocked, world)).toThrow(/walkable/);
  });
});

describe('reserved and malformed input', () => {
  it('rejects the reserved prefab property until prefabs exist', () => {
    const layers = plazaMap.layers.map((l) =>
      l.name === 'props'
        ? {
            ...l,
            objects: [
              {
                ...l.objects[0],
                properties: [
                  ...(l.objects[0].properties ?? []),
                  { name: 'prefab', type: 'string', value: 'building-small' },
                ],
              },
            ],
          }
        : l,
    );
    expect(() => parseTiledWorld({ ...plazaMap, layers })).toThrow(/prefabs/);
  });

  it('rejects something that is not a Tiled map', () => {
    expect(() => parseTiledWorld({ layers: 'nope' })).toThrow(/Tiled/);
    expect(() => parseTiledWorld(null)).toThrow(/Tiled/);
  });
});
