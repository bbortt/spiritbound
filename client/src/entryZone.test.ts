// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import {
  buildEntryZone,
  isSolid,
  EMPTY,
  MAP_W,
  MAP_H,
  TILE_SIZE,
} from './entryZone';

/** Where `spacetimedb/src/index.ts` drops a freshly created character. */
const SPAWN_X = 480;
const SPAWN_Y = 432;

const zone = buildEntryZone();

const terrainAtWorld = (x: number, y: number) =>
  zone.terrain[Math.floor(y / TILE_SIZE)][Math.floor(x / TILE_SIZE)];

describe('buildEntryZone', () => {
  it('fills every grid to the map dimensions', () => {
    for (const grid of [zone.terrain, zone.ground, zone.overlay]) {
      expect(grid).toHaveLength(MAP_H);
      for (const row of grid) expect(row).toHaveLength(MAP_W);
    }
  });

  it('is deterministic, so two clients see the same vale', () => {
    expect(buildEntryZone()).toEqual(zone);
  });

  it('walls off the cliff the player was thrown from', () => {
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < MAP_W; x++) {
        expect(isSolid(zone.terrain[y][x])).toBe(true);
      }
    }
  });

  it('leaves the foot of the cliff walkable', () => {
    for (let x = 1; x < MAP_W - 1; x++) {
      expect(isSolid(zone.terrain[5][x])).toBe(false);
    }
  });

  it('keeps the server spawn point on walkable ground below the cliff', () => {
    expect(terrainAtWorld(SPAWN_X, SPAWN_Y)).toBe('grass');
    expect(isSolid(terrainAtWorld(SPAWN_X, SPAWN_Y))).toBe(false);
  });

  it('closes the remaining map edges', () => {
    for (let y = 5; y < MAP_H; y++) {
      expect(isSolid(zone.terrain[y][0])).toBe(true);
      expect(isSolid(zone.terrain[y][MAP_W - 1])).toBe(true);
    }
    for (let x = 0; x < MAP_W; x++) {
      expect(isSolid(zone.terrain[MAP_H - 1][x])).toBe(true);
    }
  });

  it('draws a walkable trail through the vale', () => {
    const trail = zone.terrain
      .flatMap((row, y) => row.map((t, x) => ({ t, x, y })))
      .filter(({ t }) => t === 'path');

    expect(trail.length).toBeGreaterThan(200);
    for (const { t, x, y } of trail) {
      expect(isSolid(t)).toBe(false);
      expect(zone.overlay[y][x]).not.toBe(EMPTY);
    }
  });

  it('indexes only tiles that exist in the tileset image', () => {
    // mountains-v6.png is 2048x2560 at 32 px — 64 x 80 tiles.
    const tileCount = 64 * 80;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        expect(zone.ground[y][x]).toBeGreaterThanOrEqual(0);
        expect(zone.ground[y][x]).toBeLessThan(tileCount);
        expect(zone.overlay[y][x]).toBeLessThan(tileCount);
        expect(zone.overlay[y][x]).toBeGreaterThanOrEqual(EMPTY);
      }
    }
  });
});
