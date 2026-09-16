// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * World sizing, object placement and the chunk manifest.
 *
 * ## Why one map file per chunk, and not Tiled's "infinite" mode
 *
 * Tiled's infinite maps do store their data in chunks, which reads like a head
 * start. Phaser throws it away: `ParseTileLayers.js` (4.2.0, lines 135-230)
 * allocates a full `layer.width * layer.height` array of `Tile` objects and
 * blits every chunk into it. Loading a 1024x1024 infinite map would therefore
 * build 1,048,576 `Tile` instances per layer at parse time — the exact cost
 * chunking exists to avoid.
 *
 * So each chunk is its own finite `.tmj`, and the streamer in
 * `client/src/map/ChunkStreamer.ts` decides which handful of them are resident.
 */

import { buildChunk, chunkCountX, chunkCountY } from './chunk.ts';
import { SHEETS, SRC_TILE, WORLD_TILE } from './palette.ts';
import { type TiledObject } from './tmj.ts';
import {
  findSpawn,
  isSolid,
  terrainAt,
  wildTerrainAt,
  type WorldSpec,
} from './terrain.ts';
import {
  villageCentre,
  VILLAGE_HEIGHT,
  VILLAGE_WIDTH,
  type VillageSite,
} from './village.ts';

/**
 * Player base move speed, px/s. Mirrors `MOVE_SPEED` in `GameScene.ts` and
 * the figure `docs/BALANCE.md` pins the chase-speed constraint to.
 */
export const MOVE_SPEED_PX_S = 180;

/**
 * 1024 tiles at 48 world px is 49,152 px across; at 180 px/s that is 4m33s of
 * walking edge to edge, which is what "walk multiple minutes in one direction"
 * costs. 64-tile chunks divide it into a 16x16 grid.
 */
export const HOLLOW_VALE: WorldSpec = {
  width: 1024,
  height: 1024,
  chunkSize: 64,
  seed: 0x5b17,
  village: null,
};

/** Seconds to walk the full width of a world at base move speed. */
export function crossingSeconds(spec: WorldSpec): number {
  return (spec.width * WORLD_TILE) / MOVE_SPEED_PX_S;
}

/** How far from the world's centre the village is allowed to end up, in tiles. */
const VILLAGE_SEARCH_RADIUS = 0.35;
/** Tiles the siting scan steps by. Coarse: it is picking a field, not a door. */
const VILLAGE_SEARCH_STEP = 8;
/**
 * Stride the scan samples a candidate footprint at.
 *
 * Scoring every tile of every candidate is quadratic in the world size twice
 * over — on a 1024 world that is 22 million noise evaluations and eleven
 * seconds. The fields being sampled change over tens of tiles, so a third of
 * the rows and a third of the columns say the same thing for a fortieth of the
 * work.
 */
const VILLAGE_SAMPLE_STRIDE = 3;

/**
 * Where to put the village.
 *
 * This is the one thing in the exporter that looks at a whole region instead
 * of a tile, and it runs exactly once per world build. It scores candidate
 * footprints on the *wild* terrain — the land as it would be with nobody on it
 * — and takes the flattest, driest one nearest the middle of the world.
 *
 * Scoring on wild terrain rather than `terrainAt` matters: `terrainAt` already
 * answers "village" inside a sited village, so a scan over it would be scoring
 * its own output.
 *
 * Returns `null` for a world too small to hold the layout.
 */
export function findVillageSite(spec: WorldSpec): VillageSite | null {
  if (spec.width < VILLAGE_WIDTH + 4 || spec.height < VILLAGE_HEIGHT + 4) {
    return null;
  }

  const cx = Math.floor(spec.width / 2);
  const cy = Math.floor(spec.height / 2);
  const reach = Math.floor(
    Math.min(spec.width, spec.height) * VILLAGE_SEARCH_RADIUS,
  );

  let best: VillageSite | null = null;
  let bestScore = -Infinity;

  for (let oy = cy - reach; oy <= cy + reach; oy += VILLAGE_SEARCH_STEP) {
    for (let ox = cx - reach; ox <= cx + reach; ox += VILLAGE_SEARCH_STEP) {
      if (ox < 1 || oy < 1) continue;
      if (ox + VILLAGE_WIDTH >= spec.width - 1) continue;
      if (oy + VILLAGE_HEIGHT >= spec.height - 1) continue;

      let score = 0;
      for (let y = oy; y < oy + VILLAGE_HEIGHT; y += VILLAGE_SAMPLE_STRIDE) {
        for (let x = ox; x < ox + VILLAGE_WIDTH; x += VILLAGE_SAMPLE_STRIDE) {
          const wild = wildTerrainAt(x, y, spec);
          // Flat open ground is what a village wants. Woods can be cleared, so
          // they cost little. Rock cannot, so it costs a lot.
          if (wild === 'grass') score += 2;
          else if (wild === 'path') score += 3;
          else if (wild === 'forest') score += 1;
          else score -= 8;
        }
      }

      // All else equal, closer to the middle of the world — and so closer to
      // where the player wakes up.
      score -= (Math.abs(ox - cx) + Math.abs(oy - cy)) / 32;

      if (score > bestScore) {
        bestScore = score;
        best = { x: ox, y: oy };
      }
    }
  }

  return best;
}

/** A world with its village sited. This is what the exporter actually draws. */
export function settle(spec: WorldSpec): WorldSpec {
  return { ...spec, village: findVillageSite(spec) };
}

/** One spirit bonfire every this many chunks, on both axes. */
const SPIRIT_CHUNK_STRIDE = 4;
/** One dungeon entrance every this many chunks, on both axes. */
const DUNGEON_CHUNK_STRIDE = 8;

/**
 * The nearest walkable tile to a point, searched outward. Used to nail objects
 * onto ground the player can actually stand on rather than into a cliff.
 */
function nearestWalkable(
  x: number,
  y: number,
  spec: WorldSpec,
): { x: number; y: number } | null {
  for (let r = 0; r < spec.chunkSize; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!isSolid(terrainAt(x + dx, y + dy, spec))) {
          return { x: x + dx, y: y + dy };
        }
      }
    }
  }
  return null;
}

/**
 * The non-tile data for one chunk.
 *
 * This is where `SpiritDefinition.zone_id` and `DungeonDefinition.zone_id` get
 * actual coordinates: the zone rectangle carries the id, and the spirit and
 * dungeon points carry the slug the content pipeline will key on.
 */
export function chunkObjects(
  cx: number,
  cy: number,
  spec: WorldSpec,
  spawn: { x: number; y: number },
  zoneId: number,
  zoneSlug: string,
): TiledObject[] {
  const size = spec.chunkSize;
  const objects: TiledObject[] = [];
  let nextId = 1;

  // Local pixel coordinate of a world tile's centre, in source-tile pixels.
  const local = (wx: number, wy: number) => ({
    x: (wx - cx * size) * SRC_TILE + SRC_TILE / 2,
    y: (wy - cy * size) * SRC_TILE + SRC_TILE / 2,
  });

  objects.push({
    id: nextId++,
    name: zoneSlug,
    type: 'zone',
    x: 0,
    y: 0,
    width: size * SRC_TILE,
    height: size * SRC_TILE,
    properties: [
      { name: 'zone_id', type: 'int', value: zoneId },
      { name: 'zone_slug', type: 'string', value: zoneSlug },
    ],
  });

  if (Math.floor(spawn.x / size) === cx && Math.floor(spawn.y / size) === cy) {
    const p = local(spawn.x, spawn.y);
    objects.push({
      id: nextId++,
      name: 'spawn',
      type: 'spawn',
      x: p.x,
      y: p.y,
      width: 0,
      height: 0,
      point: true,
      properties: [{ name: 'zone_id', type: 'int', value: zoneId }],
    });
  }

  if (cx % SPIRIT_CHUNK_STRIDE === 0 && cy % SPIRIT_CHUNK_STRIDE === 0) {
    const centre = nearestWalkable(
      cx * size + size / 2,
      cy * size + size / 2,
      spec,
    );
    if (centre) {
      const p = local(centre.x, centre.y);
      objects.push({
        id: nextId++,
        name: `spirit-${cx}-${cy}`,
        type: 'spirit',
        x: p.x,
        y: p.y,
        width: 0,
        height: 0,
        point: true,
        properties: [{ name: 'zone_id', type: 'int', value: zoneId }],
      });
    }
  }

  if (spec.village) {
    const centre = villageCentre(spec.village);
    if (
      Math.floor(centre.x / size) === cx &&
      Math.floor(centre.y / size) === cy
    ) {
      const p = local(centre.x, centre.y);
      objects.push({
        id: nextId++,
        name: 'millbrook',
        type: 'village',
        x: p.x,
        y: p.y,
        width: 0,
        height: 0,
        point: true,
        properties: [
          { name: 'zone_id', type: 'int', value: zoneId },
          { name: 'village_slug', type: 'string', value: 'millbrook' },
        ],
      });
    }
  }

  if (
    cx % DUNGEON_CHUNK_STRIDE === DUNGEON_CHUNK_STRIDE / 2 &&
    cy % DUNGEON_CHUNK_STRIDE === DUNGEON_CHUNK_STRIDE / 2
  ) {
    const spot = nearestWalkable(
      cx * size + size / 4,
      cy * size + size / 4,
      spec,
    );
    if (spot) {
      const p = local(spot.x, spot.y);
      objects.push({
        id: nextId++,
        name: `dungeon-${cx}-${cy}`,
        type: 'dungeon_entrance',
        x: p.x,
        y: p.y,
        width: 0,
        height: 0,
        point: true,
        properties: [{ name: 'zone_id', type: 'int', value: zoneId }],
      });
    }
  }

  return objects;
}

export interface WorldManifest {
  zoneId: number;
  zoneSlug: string;
  seed: number;
  /** Tiles. */
  width: number;
  height: number;
  chunkSize: number;
  chunksX: number;
  chunksY: number;
  /** Source tile size of the sheet, and the size it renders at in world units. */
  srcTile: number;
  worldTile: number;
  /** Spawn, in world tile coordinates and in world pixels. */
  spawn: { tileX: number; tileY: number; x: number; y: number };
  /** `chunks/${cy}/${cx}.tmj`, relative to the manifest. */
  chunkPath: string;
  walkabilityPath: string;
  /**
   * Every sheet a chunk references, in `firstgid` order. `name` is the tileset
   * name inside the `.tmj`, which is the first argument
   * `map.addTilesetImage(name, key)` needs; `image` is where to load it from,
   * relative to the manifest.
   */
  tilesets: { name: string; image: string }[];
  /** Top-left tile of the village, or `null` in a world without one. */
  village: {
    tileX: number;
    tileY: number;
    width: number;
    height: number;
  } | null;
}

export function buildManifest(
  spec: WorldSpec,
  zoneId: number,
  zoneSlug: string,
): WorldManifest {
  const spawn = findSpawn(spec);
  return {
    zoneId,
    zoneSlug,
    seed: spec.seed,
    width: spec.width,
    height: spec.height,
    chunkSize: spec.chunkSize,
    chunksX: chunkCountX(spec),
    chunksY: chunkCountY(spec),
    srcTile: SRC_TILE,
    worldTile: WORLD_TILE,
    spawn: {
      tileX: spawn.x,
      tileY: spawn.y,
      x: spawn.x * WORLD_TILE + WORLD_TILE / 2,
      y: spawn.y * WORLD_TILE + WORLD_TILE / 2,
    },
    chunkPath: 'chunks/{cy}/{cx}.tmj',
    walkabilityPath: 'walkability.bin',
    tilesets: SHEETS.map((s) => ({ name: s.name, image: `../${s.image}` })),
    village: spec.village
      ? {
          tileX: spec.village.x,
          tileY: spec.village.y,
          width: VILLAGE_WIDTH,
          height: VILLAGE_HEIGHT,
        }
      : null,
  };
}

export { buildChunk, chunkCountX, chunkCountY };
