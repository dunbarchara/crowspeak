import { describe, expect, it } from 'vitest';
import manifest from '../../public/worlds/plaza@1/manifest.json';
import map from '../../public/worlds/plaza@1/map.json';
import {
  HttpWorldSource,
  type WorldRef,
  type WorldSource,
  formatWorldRef,
  loadWorld,
  parseWorldManifest,
  parseWorldRef,
} from './worldLoader';

/** A source backed by an in-memory table of `ref/file` -> JSON. */
const memory = (files: Record<string, unknown>): WorldSource => ({
  async readJson(ref: WorldRef, file: string) {
    const key = `${formatWorldRef(ref)}/${file}`;
    if (!(key in files)) throw new Error(`missing ${key}`);
    return files[key];
  },
});
const plaza = (overrides: Record<string, unknown> = {}) =>
  memory({
    'plaza@1/manifest.json': manifest,
    'plaza@1/map.json': map,
    ...overrides,
  });

describe('parseWorldRef', () => {
  it('splits world_id@version', () => {
    expect(parseWorldRef('plaza@1')).toEqual({
      worldId: 'plaza',
      version: '1',
    });
    expect(parseWorldRef('old-town@2.1.0')).toEqual({
      worldId: 'old-town',
      version: '2.1.0',
    });
  });

  it('rejects anything else', () => {
    for (const bad of ['plaza', 'plaza@', '@1', 'Plaza@1', 'a/b@1', 'a@../1']) {
      expect(() => parseWorldRef(bad)).toThrow(/world_id@version/);
    }
  });
});

describe('parseWorldManifest', () => {
  const ref = parseWorldRef('plaza@1');

  it('accepts the plaza manifest, with a numeric or text version', () => {
    expect(parseWorldManifest(manifest, ref).map).toBe('map.json');
    expect(parseWorldManifest({ ...manifest, version: 1 }, ref).version).toBe(
      '1',
    );
  });

  it('rejects a manifest for a different world or version', () => {
    expect(() =>
      parseWorldManifest({ ...manifest, version: '2' }, ref),
    ).toThrow(/plaza@2/);
    expect(() =>
      parseWorldManifest({ ...manifest, worldId: 'x' }, ref),
    ).toThrow(/x@1/);
  });

  it('rejects unsafe or missing map paths and unknown schemas', () => {
    for (const map of [
      '../secret.json',
      '/etc/passwd',
      'a\\b.json',
      'http://x/y',
      '',
      'a//b',
    ]) {
      expect(() => parseWorldManifest({ ...manifest, map }, ref)).toThrow(
        /map/,
      );
    }
    expect(() => parseWorldManifest({ ...manifest, schema: 2 }, ref)).toThrow(
      /schema/,
    );
    expect(() => parseWorldManifest(null, ref)).toThrow(/object/);
  });
});

describe('loadWorld', () => {
  it('loads, parses and validates the plaza', async () => {
    const loaded = await loadWorld(plaza(), 'plaza@1');
    expect(formatWorldRef(loaded.ref)).toBe('plaza@1');
    expect(loaded.definition.npcAnchors.map((a) => a.npcId).sort()).toEqual([
      'alfonso',
      'maria',
      'npc-demo',
      'poncho',
      'rosa',
    ]);
    expect(loaded.levels.grids).toHaveLength(2);
  });

  it('is source-agnostic: the map can be named anywhere under the world folder', async () => {
    const loaded = await loadWorld(
      memory({
        'plaza@1/manifest.json': { ...manifest, map: 'maps/main.json' },
        'plaza@1/maps/main.json': map,
      }),
      'plaza@1',
    );
    expect(loaded.manifest.map).toBe('maps/main.json');
  });

  it('fails on a bad reference, a missing file or a mismatched manifest', async () => {
    await expect(loadWorld(plaza(), 'plaza')).rejects.toThrow(
      /world_id@version/,
    );
    await expect(loadWorld(plaza(), 'plaza@2')).rejects.toThrow(
      /missing plaza@2/,
    );
    await expect(
      loadWorld(
        plaza({ 'plaza@1/manifest.json': { ...manifest, version: '9' } }),
        'plaza@1',
      ),
    ).rejects.toThrow(/plaza@9/);
  });

  it('fails when the map is invalid', async () => {
    await expect(
      loadWorld(plaza({ 'plaza@1/map.json': { not: 'a map' } }), 'plaza@1'),
    ).rejects.toThrow(/Tiled/);
  });
});

describe('HttpWorldSource', () => {
  const respond = (status: number, body: unknown = {}) =>
    (async () =>
      new Response(JSON.stringify(body), { status })) as typeof fetch;

  it('reads <base>/<world_id@version>/<file>', async () => {
    const urls: string[] = [];
    const source = new HttpWorldSource('/worlds/', (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ ok: true }));
    }) as typeof fetch);
    expect(
      await source.readJson(parseWorldRef('plaza@1'), 'manifest.json'),
    ).toEqual({
      ok: true,
    });
    expect(urls).toEqual(['/worlds/plaza@1/manifest.json']);
  });

  it('reports the URL and status when a file is missing', async () => {
    const source = new HttpWorldSource('/worlds', respond(404));
    await expect(
      source.readJson(parseWorldRef('plaza@1'), 'manifest.json'),
    ).rejects.toThrow(/\/worlds\/plaza@1\/manifest\.json.*404/);
  });
});
