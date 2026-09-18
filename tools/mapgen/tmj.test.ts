// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Can Phaser actually read what the exporter writes?
 *
 * These tests run Phaser 4.2.0's own `ParseJSONTiled` over the emitted maps
 * (see `phaserTiledParser.ts`) rather than checking the JSON against a
 * hand-written idea of the Tiled format. Phaser's parser answers warnings, not
 * exceptions, when it cannot use something, so the helper promotes any
 * `console.warn` into a failure.
 */

import { describe, expect, it } from 'vitest';

import { buildChunk } from './chunk.ts';
import {
  FIRST_GID,
  SHEETS,
  SOLID_GIDS,
  SRC_TILE,
  tileCount,
} from './palette.ts';
import { objectsOf, parseAsPhaser, propOf } from './phaserTiledParser.ts';
import { chunkToTmj, encodeLayer } from './tmj.ts';
import { type WorldSpec } from './terrain.ts';
import { chunkObjects, HOLLOW_VALE, settle } from './world.ts';
import { villageCentre } from './village.ts';

const SPEC: WorldSpec = settle({
  width: 256,
  height: 256,
  chunkSize: 64,
  seed: 0x5b17,
  village: null,
});

/** One past the last gid any sheet owns. */
const LAST_GID =
  SHEETS[SHEETS.length - 1].firstGid + tileCount(SHEETS[SHEETS.length - 1]);
const ZONE_ID = 1;
const ZONE_SLUG = 'hollow-vale';

function tmjFor(cx: number, cy: number, spawn = { x: -1, y: -1 }): unknown {
  return chunkToTmj(
    buildChunk(cx, cy, SPEC),
    SPEC,
    chunkObjects(cx, cy, SPEC, spawn, ZONE_ID, ZONE_SLUG),
  );
}

describe('a chunk parses as a Phaser tilemap', () => {
  const map = parseAsPhaser(tmjFor(1, 1));

  it('is a 64x64 orthogonal map of 16px tiles', () => {
    expect(map.width).toBe(64);
    expect(map.height).toBe(64);
    expect(map.tileWidth).toBe(SRC_TILE);
    expect(map.tileHeight).toBe(SRC_TILE);
    expect(map.infinite).toBe(false);
  });

  it('exposes the three tile layers the renderer draws', () => {
    expect(map.layers.map((l) => l.name)).toEqual([
      'ground',
      'overlay',
      'above',
    ]);
    for (const layer of map.layers) {
      expect(layer.width).toBe(64);
      expect(layer.height).toBe(64);
      expect(layer.data).toHaveLength(64);
      expect(layer.data[0]).toHaveLength(64);
    }
  });

  it('decodes base64 layer data into real tiles', () => {
    const ground = map.layers[0];
    // Ground is opaque everywhere: no nulls, and every index in the sheet.
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const tile = ground.data[y][x];
        expect(tile).not.toBeNull();
        expect(tile!.index).toBeGreaterThanOrEqual(FIRST_GID);
        expect(tile!.index).toBeLessThan(LAST_GID);
      }
    }
  });

  it('leaves the overlay and above layers sparse', () => {
    // Chunk (2, 1) is the one with a bit of everything in it — trail, cliff
    // foot, woods. Chunk (1, 1) is open meadow and has an empty overlay, which
    // is correct and would make a poor test.
    const mixed = parseAsPhaser(tmjFor(2, 1));
    for (const name of ['overlay', 'above']) {
      const layer = mixed.layers.find((l) => l.name === name)!;
      const filled = layer.data.flat().filter((t) => t !== null).length;
      expect(filled).toBeGreaterThan(0);
      expect(filled).toBeLessThan(64 * 64);
    }
  });
});

describe('both tilesets survive the parser', () => {
  const map = parseAsPhaser(tmjFor(1, 1));

  it('keeps every sheet, embedded, in firstgid order', () => {
    // ParseTilesets.js drops any tileset with a `source` field, warning
    // "External tilesets unsupported". The warning-to-failure promotion in
    // parseAsPhaser would already have caught it; this asserts the result.
    expect(map.tilesets).toHaveLength(SHEETS.length);
    for (let i = 0; i < SHEETS.length; i++) {
      expect(map.tilesets[i].name).toBe(SHEETS[i].name);
      expect(map.tilesets[i].firstgid).toBe(SHEETS[i].firstGid);
      expect(map.tilesets[i].total).toBe(tileCount(SHEETS[i]));
    }
  });

  it('carries the collides property on exactly the solid tiles', () => {
    // Tiled stores collision against a tile's *local* id, so the flags have to
    // be gathered back up per sheet before they can be compared to the gids
    // the palette calls solid.
    const flagged: number[] = [];
    for (let i = 0; i < SHEETS.length; i++) {
      const { tileProperties, firstgid } = map.tilesets[i];
      for (const id of Object.keys(tileProperties)) {
        if (tileProperties[id]?.collides === true) {
          flagged.push(Number(id) + firstgid);
        }
      }
    }
    expect(flagged.sort((a, b) => a - b)).toEqual(
      [...SOLID_GIDS].sort((a, b) => a - b),
    );
  });
});

describe('the object layer carries the non-tile data', () => {
  it('gives every chunk a zone rectangle with its zone_id', () => {
    const map = parseAsPhaser(tmjFor(2, 3));
    const zones = objectsOf(map, 'objects').filter((o) => o.type === 'zone');

    expect(zones).toHaveLength(1);
    expect(zones[0].name).toBe(ZONE_SLUG);
    expect(zones[0].width).toBe(SPEC.chunkSize * SRC_TILE);
    expect(propOf(zones[0], 'zone_id')).toBe(ZONE_ID);
  });

  it('places the spawn point in the chunk that contains it, and nowhere else', () => {
    const spawn = { x: 70, y: 130 }; // chunk (1, 2)
    const typesIn = (cx: number, cy: number) =>
      objectsOf(parseAsPhaser(tmjFor(cx, cy, spawn)), 'objects').map(
        (o) => o.type,
      );

    expect(typesIn(1, 2)).toContain('spawn');
    expect(typesIn(1, 1)).not.toContain('spawn');
    expect(typesIn(0, 0)).not.toContain('spawn');
  });

  it('puts the spawn point at the right pixel inside its chunk', () => {
    const spawn = { x: 70, y: 130 };
    const map = parseAsPhaser(tmjFor(1, 2, spawn));
    const point = objectsOf(map, 'objects').find((o) => o.type === 'spawn')!;
    expect(point.x).toBe((70 - 64) * SRC_TILE + SRC_TILE / 2);
    expect(point.y).toBe((130 - 128) * SRC_TILE + SRC_TILE / 2);
  });

  it('seeds spirits and dungeon entrances on walkable ground', () => {
    const spirits = objectsOf(parseAsPhaser(tmjFor(0, 0)), 'objects').filter(
      (o) => o.type === 'spirit',
    );
    const dungeons = objectsOf(parseAsPhaser(tmjFor(4, 4)), 'objects').filter(
      (o) => o.type === 'dungeon_entrance',
    );

    expect(spirits).toHaveLength(1);
    expect(dungeons).toHaveLength(1);
  });

  it('marks the village in the one chunk its centre falls in', () => {
    const centre = villageCentre(SPEC.village!);
    const home = {
      cx: Math.floor(centre.x / SPEC.chunkSize),
      cy: Math.floor(centre.y / SPEC.chunkSize),
    };
    const villagesIn = (cx: number, cy: number) =>
      objectsOf(parseAsPhaser(tmjFor(cx, cy)), 'objects').filter(
        (o) => o.type === 'village',
      );

    const found = villagesIn(home.cx, home.cy);
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('millbrook');
    expect(found[0].x).toBe(
      (centre.x - home.cx * SPEC.chunkSize) * SRC_TILE + SRC_TILE / 2,
    );

    // And nowhere else: pick a chunk that is definitely not the village's.
    const other = { cx: (home.cx + 2) % 4, cy: (home.cy + 2) % 4 };
    expect(villagesIn(other.cx, other.cy)).toHaveLength(0);
  });
});

describe('the two Phaser traps stay avoided', () => {
  const raw = tmjFor(1, 1) as {
    layers: { type: string; compression?: string; encoding?: string }[];
    tilesets: { source?: string; image?: string }[];
  };

  it('never sets compression on a layer', () => {
    // ParseTileLayers.js: `if (curl.compression) { console.warn(...); continue; }`
    // A compressed layer is silently dropped, not rejected.
    for (const layer of raw.layers) {
      expect(layer.compression).toBeUndefined();
    }
  });

  it('never references a tileset by file', () => {
    for (const set of raw.tilesets) {
      expect(set.source).toBeUndefined();
      expect(set.image).toBeDefined();
    }
  });

  it('encodes tile layers as uncompressed base64 little-endian gids', () => {
    expect(encodeLayer([1, 258, 0])).toBe(
      Buffer.from([1, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0]).toString('base64'),
    );
    for (const layer of raw.layers.filter((l) => l.type === 'tilelayer')) {
      expect(layer.encoding).toBe('base64');
    }
  });
});

describe('the shipped world spec parses too', () => {
  it('parses a chunk of the real 1024x1024 Hollow Vale', () => {
    const vale = settle(HOLLOW_VALE);
    const map = parseAsPhaser(
      chunkToTmj(
        buildChunk(8, 8, vale),
        vale,
        chunkObjects(8, 8, vale, { x: 511, y: 511 }, ZONE_ID, ZONE_SLUG),
      ),
    );
    expect(map.layers).toHaveLength(3);
    expect(map.tilesets).toHaveLength(SHEETS.length);
  });
});
