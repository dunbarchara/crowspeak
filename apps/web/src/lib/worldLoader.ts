import {
  type WorldDefinition,
  parseTiledWorld,
  toLevelWorld,
  validateWorld,
} from './world';
import type { LevelWorld } from './levels';

/** A world address, written `world_id@version`. Versions are immutable once published. */
export interface WorldRef {
  worldId: string;
  version: string;
}

const REF = /^([a-z0-9][a-z0-9-]*)@([A-Za-z0-9][A-Za-z0-9._-]*)$/;

export function parseWorldRef(text: string): WorldRef {
  const match = REF.exec(text);
  if (!match) {
    throw new Error(`Bad world reference "${text}", expected world_id@version`);
  }
  return { worldId: match[1], version: match[2] };
}

export function formatWorldRef(ref: WorldRef): string {
  return `${ref.worldId}@${ref.version}`;
}

/**
 * Where a world's files come from. `file` is a path relative to the world's own folder.
 * Bundled static files implement this today; backend-served manifests can later.
 */
export interface WorldSource {
  readJson(ref: WorldRef, file: string): Promise<unknown>;
}

/** Reads `<baseUrl>/<world_id@version>/<file>` over HTTP: static hosting or a CDN. */
export class HttpWorldSource implements WorldSource {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(
    baseUrl: string,
    fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchFn = fetchFn;
  }

  async readJson(ref: WorldRef, file: string): Promise<unknown> {
    const url = `${this.baseUrl}/${formatWorldRef(ref)}/${file}`;
    const response = await this.fetchFn(url);
    if (!response.ok) {
      throw new Error(`Could not load ${url} (HTTP ${response.status})`);
    }
    return response.json();
  }
}

/** The small JSON file at the root of a world. Other files are named relative to it. */
export interface WorldManifest {
  schema: 1;
  worldId: string;
  version: string;
  map: string;
}

/** Plain relative paths only: no absolute paths, schemes, backslashes or `..`. */
function isSafeRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !/[\\:]/.test(path) &&
    !path.split('/').some((part) => part === '..' || part === '')
  );
}

export function parseWorldManifest(
  data: unknown,
  ref: WorldRef,
): WorldManifest {
  const m = data as Record<string, unknown> | null;
  const label = formatWorldRef(ref);
  if (typeof m !== 'object' || m === null) {
    throw new Error(`World ${label}: the manifest is not an object`);
  }
  if (m.schema !== 1) {
    throw new Error(
      `World ${label}: unsupported manifest schema ${String(m.schema)}`,
    );
  }
  // Guard against a mis-published folder: the manifest must say what it is.
  if (m.worldId !== ref.worldId || String(m.version) !== ref.version) {
    throw new Error(
      `World ${label}: the manifest is for ${String(m.worldId)}@${String(m.version)}`,
    );
  }
  if (typeof m.map !== 'string' || !isSafeRelativePath(m.map)) {
    throw new Error(`World ${label}: the manifest needs a relative "map" path`);
  }
  return { schema: 1, worldId: ref.worldId, version: ref.version, map: m.map };
}

/** A world ready for the scene: parsed, validated and with its collision grids built. */
export interface LoadedWorld {
  ref: WorldRef;
  manifest: WorldManifest;
  definition: WorldDefinition;
  levels: LevelWorld;
}

/**
 * Load `world_id@version` from a source. Fails with a descriptive error if any file is
 * missing or invalid, so a half-loaded world never reaches the scene.
 */
export async function loadWorld(
  source: WorldSource,
  reference: string,
): Promise<LoadedWorld> {
  const ref = parseWorldRef(reference);
  const manifest = parseWorldManifest(
    await source.readJson(ref, 'manifest.json'),
    ref,
  );
  const definition = expandWorld(
    parseTiledWorld(await source.readJson(ref, manifest.map)),
  );
  const levels = toLevelWorld(definition);
  validateWorld(definition, levels);
  return { ref, manifest, definition, levels };
}

/**
 * The seam for reusable building prefabs: it will merge each instance with its prefab and
 * expand it into plain props and footprints. Until prefabs exist it changes nothing.
 */
export function expandWorld(definition: WorldDefinition): WorldDefinition {
  return definition;
}
