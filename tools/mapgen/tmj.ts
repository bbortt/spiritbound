// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Tiled `.tmj` emitter.
 *
 * Two things about Phaser's Tiled parser drive the shape of what this writes,
 * both verified against `phaser/src/tilemaps/parsers/tiled/` at 4.2.0 rather
 * than assumed:
 *
 * 1. `ParseTilesets.js` warns "External tilesets unsupported" and drops any
 *    tileset with a `source` field. So the tileset is embedded in every chunk.
 *    It costs about 1 KB per file, which is the price of the map loading at
 *    all.
 * 2. `ParseTileLayers.js` skips any layer carrying a `compression` field, with
 *    a console warning and no thrown error — a silent blank map. So layer data
 *    is base64 **uncompressed**. The wire is still cheap: these files gzip to
 *    a fraction of their size at the HTTP layer.
 *
 * Tiled's own "infinite" mode is deliberately not used; see `world.ts`.
 */

import { type ChunkData } from './chunk.ts';
import {
  SHEETS,
  SOLID_GIDS,
  SRC_TILE,
  type Sheet,
  tileCount,
} from './palette.ts';
import { type WorldSpec } from './terrain.ts';

/** Little-endian uint32 gids, base64'd — the encoding Phaser can actually read. */
export function encodeLayer(gids: readonly number[]): string {
  const buf = Buffer.allocUnsafe(gids.length * 4);
  for (let i = 0; i < gids.length; i++) buf.writeUInt32LE(gids[i], i * 4);
  return buf.toString('base64');
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  /** Pixel coordinates, local to the chunk, in source-tile pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  properties?: { name: string; type: string; value: number | string }[];
}

/**
 * One embedded tileset per sheet. Collision lives on tile properties
 * (`collides`), which is what `layer.setCollisionByProperty({ collides: true })`
 * reads — but note that the client's tilemap is presentation only. The
 * authority is the walkability bitmask the server loads; see `walkability.ts`.
 *
 * `image` is written relative to the chunk file so the map opens correctly in
 * Tiled. Phaser never reads it: the game loads the sheet under its own key and
 * pairs it up with `map.addTilesetImage(name, key)`.
 */
function tilesetJson(sheet: Sheet) {
  const total = tileCount(sheet);
  return {
    columns: sheet.columns,
    firstgid: sheet.firstGid,
    image: `../../../tiles/${sheet.image}`,
    imageheight: sheet.rows * SRC_TILE,
    imagewidth: sheet.columns * SRC_TILE,
    margin: 0,
    name: sheet.name,
    spacing: 0,
    tilecount: total,
    tileheight: SRC_TILE,
    tilewidth: SRC_TILE,
    tiles: SOLID_GIDS.filter(
      (g) => g >= sheet.firstGid && g < sheet.firstGid + total,
    ).map((g) => ({
      id: g - sheet.firstGid,
      properties: [{ name: 'collides', type: 'bool', value: true }],
    })),
  };
}

function tileLayer(
  id: number,
  name: string,
  data: readonly number[],
  size: number,
) {
  return {
    compressionlevel: -1,
    data: encodeLayer(data),
    encoding: 'base64',
    height: size,
    id,
    name,
    opacity: 1,
    type: 'tilelayer',
    visible: true,
    width: size,
    x: 0,
    y: 0,
  };
}

export function chunkToTmj(
  chunk: ChunkData,
  spec: WorldSpec,
  objects: TiledObject[],
): unknown {
  const size = chunk.size;
  return {
    backgroundcolor: '#101418',
    compressionlevel: -1,
    height: size,
    infinite: false,
    layers: [
      tileLayer(1, 'ground', chunk.ground, size),
      tileLayer(2, 'overlay', chunk.overlay, size),
      tileLayer(3, 'above', chunk.above, size),
      {
        draworder: 'topdown',
        id: 4,
        name: 'objects',
        objects,
        opacity: 1,
        type: 'objectgroup',
        visible: true,
        x: 0,
        y: 0,
      },
    ],
    nextlayerid: 5,
    nextobjectid: objects.length + 1,
    orientation: 'orthogonal',
    properties: [
      { name: 'chunkX', type: 'int', value: chunk.cx },
      { name: 'chunkY', type: 'int', value: chunk.cy },
      { name: 'originX', type: 'int', value: chunk.originX },
      { name: 'originY', type: 'int', value: chunk.originY },
      { name: 'worldSeed', type: 'int', value: spec.seed },
    ],
    renderorder: 'right-down',
    tiledversion: '1.11.2',
    tileheight: SRC_TILE,
    tilesets: SHEETS.map(tilesetJson),
    tilewidth: SRC_TILE,
    type: 'map',
    version: '1.10',
    width: size,
  };
}
