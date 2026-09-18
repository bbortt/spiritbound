// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, expect, it } from 'vitest';

import { buildChunk } from './chunk.ts';
import {
  canopiesOver,
  CLIFF_FACE_ROWS,
  findSpawn,
  isCliffFoot,
  isSolid,
  terrainAt,
  treeAt,
  wildTerrainAt,
  type WorldSpec,
} from './terrain.ts';
import {
  crossingSeconds,
  findVillageSite,
  HOLLOW_VALE,
  MOVE_SPEED_PX_S,
  settle,
} from './world.ts';
import { WORLD_TILE } from './palette.ts';
import {
  VILLAGE_HEIGHT,
  VILLAGE_WIDTH,
  villageCentre,
  villageCellAt,
} from './village.ts';

/**
 * Small enough to scan exhaustively, big enough to contain real features.
 * Deliberately wild — no village — so the terrain tests below are testing the
 * field and not a building someone dropped on it. See `SETTLED`.
 */
const SMALL: WorldSpec = {
  width: 256,
  height: 256,
  chunkSize: 64,
  seed: 0x5b17,
  village: null,
};

/** The same world with Millbrook sited, which is what the exporter draws. */
const SETTLED: WorldSpec = settle(SMALL);

describe('the world is big enough to walk across for minutes', () => {
  it('takes over three minutes to cross Hollow Vale at base move speed', () => {
    expect(crossingSeconds(HOLLOW_VALE)).toBeGreaterThan(180);
  });

  it('is sized from the move speed actually in the client, not a guess', () => {
    // GameScene.ts's MOVE_SPEED, which docs/BALANCE.md pins the enemy chase
    // constraint to. If that moves, this crossing time moves with it.
    expect(MOVE_SPEED_PX_S).toBe(180);
    expect(HOLLOW_VALE.width * WORLD_TILE).toBe(49152);
  });

  it('divides evenly into chunks', () => {
    expect(HOLLOW_VALE.width % HOLLOW_VALE.chunkSize).toBe(0);
    expect(HOLLOW_VALE.height % HOLLOW_VALE.chunkSize).toBe(0);
  });
});

describe('the terrain field is a pure function of position', () => {
  it('returns the same terrain however many times it is asked', () => {
    for (const [x, y] of [
      [3, 3],
      [77, 12],
      [128, 200],
      [255, 255],
    ]) {
      expect(terrainAt(x, y, SMALL)).toBe(terrainAt(x, y, SMALL));
    }
  });

  it('gives a chunk the same tiles whether built alone or after its neighbours', () => {
    const alone = buildChunk(2, 1, SMALL);
    buildChunk(0, 0, SMALL);
    buildChunk(3, 3, SMALL);
    const after = buildChunk(2, 1, SMALL);
    expect(after.terrain).toEqual(alone.terrain);
    expect(after.ground).toEqual(alone.ground);
    expect(after.overlay).toEqual(alone.overlay);
    expect(after.above).toEqual(alone.above);
  });

  it('agrees with buildChunk tile for tile', () => {
    const chunk = buildChunk(1, 2, SMALL);
    for (let ly = 0; ly < chunk.size; ly++) {
      for (let lx = 0; lx < chunk.size; lx++) {
        expect(chunk.terrain[ly * chunk.size + lx]).toBe(
          terrainAt(chunk.originX + lx, chunk.originY + ly, SMALL),
        );
      }
    }
  });

  it('carries cliffs across a chunk seam', () => {
    // The interesting case for chunking: a plateau in chunk (cx, cy-1) whose
    // face falls into the first rows of chunk (cx, cy). If the generator had
    // any hidden per-chunk state those top rows would come out as grass.
    //
    // Which chunks have such a seam is up to the noise, so this sweeps them
    // all rather than betting on one — an earlier version pinned chunk (1, 1)
    // and started failing the day the elevation field was retuned, without
    // anything about chunking having changed.
    let seamCliffs = 0;

    for (let cy = 1; cy < SMALL.height / SMALL.chunkSize; cy++) {
      for (let cx = 0; cx < SMALL.width / SMALL.chunkSize; cx++) {
        const lower = buildChunk(cx, cy, SMALL);
        for (let ly = 0; ly < CLIFF_FACE_ROWS; ly++) {
          for (let lx = 0; lx < lower.size; lx++) {
            if (lower.terrain[ly * lower.size + lx] !== 'cliff') continue;
            seamCliffs++;
            // Its plateau lives in the chunk above, which was never built.
            const above: string[] = [];
            for (let d = 1; d <= CLIFF_FACE_ROWS; d++) {
              above.push(
                terrainAt(lower.originX + lx, lower.originY + ly - d, SMALL),
              );
            }
            expect(above).toContain('plateau');
          }
        }
      }
    }

    expect(seamCliffs).toBeGreaterThan(0);
  });
});

describe('the world has a walled edge and cliffs that hang the right way', () => {
  it('walls the one-tile border ring', () => {
    for (const [x, y] of [
      [0, 0],
      [0, 130],
      [255, 12],
      [77, 255],
      [255, 255],
    ]) {
      expect(terrainAt(x, y, SMALL)).toBe('wall');
    }
    expect(terrainAt(-1, 40, SMALL)).toBe('wall');
    expect(terrainAt(40, 999, SMALL)).toBe('wall');
  });

  it('only ever puts cliff face below plateau, never above it', () => {
    let seen = 0;
    for (let y = 1; y < SMALL.height - 1; y++) {
      for (let x = 1; x < SMALL.width - 1; x++) {
        if (terrainAt(x, y, SMALL) !== 'cliff') continue;
        seen++;
        const above: string[] = [];
        for (let d = 1; d <= CLIFF_FACE_ROWS; d++) {
          above.push(terrainAt(x, y - d, SMALL));
        }
        expect(above).toContain('plateau');
      }
    }
    expect(seen).toBeGreaterThan(100);
  });

  it('generates every wild terrain somewhere', () => {
    const seen = new Set<string>();
    for (let y = 0; y < SMALL.height; y++) {
      for (let x = 0; x < SMALL.width; x++) seen.add(terrainAt(x, y, SMALL));
    }
    expect([...seen].sort()).toEqual([
      'cliff',
      'forest',
      'grass',
      'path',
      'plateau',
      'tree',
      'wall',
    ]);
  });
});

describe('the woods', () => {
  const counts = new Map<string, number>();
  for (let y = 0; y < SMALL.height; y++) {
    for (let x = 0; x < SMALL.width; x++) {
      const t = terrainAt(x, y, SMALL);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const area = SMALL.width * SMALL.height;

  it('covers enough ground to be woods rather than a shrub', () => {
    const woodland = (counts.get('forest') ?? 0) + (counts.get('tree') ?? 0);
    expect(woodland / area).toBeGreaterThan(0.1);
    expect(woodland / area).toBeLessThan(0.5);
  });

  it('is walkable except where a trunk stands', () => {
    expect(isSolid('forest')).toBe(false);
    expect(isSolid('tree')).toBe(true);
  });

  it('only grows trees on woodland floor, never on rock or a trail', () => {
    for (let y = 0; y < SMALL.height; y++) {
      for (let x = 0; x < SMALL.width; x++) {
        if (treeAt(x, y, SMALL) === null) continue;
        expect(wildTerrainAt(x, y, SMALL)).toBe('forest');
      }
    }
  });

  it('spaces trunks out instead of packing them solid', () => {
    const trunks = counts.get('tree') ?? 0;
    const woodland = (counts.get('forest') ?? 0) + trunks;
    // One anchor per 4x4 cell is 6.25% at most, and roughly an eighth of cells
    // are left empty as clearings.
    expect(trunks / woodland).toBeLessThan(0.07);
    expect(trunks).toBeGreaterThan(100);
  });

  it('hangs a canopy over the tiles north of each trunk', () => {
    let checked = 0;
    for (let y = 2; y < SMALL.height; y++) {
      for (let x = 1; x < SMALL.width - 1; x++) {
        if (terrainAt(x, y, SMALL) !== 'tree') continue;
        // A trunk's own tile is covered by the bottom row of its sprite.
        expect(
          canopiesOver(x, y, SMALL).some((t) => t.x === x && t.y === y),
        ).toBe(true);
        // And so is the tile two rows above it, where the crown sits.
        expect(
          canopiesOver(x, y - 2, SMALL).some((t) => t.x === x && t.y === y),
        ).toBe(true);
        if (++checked > 50) return;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('sorts overlapping canopies far to near, so the nearer tree wins', () => {
    for (let y = 0; y < SMALL.height; y++) {
      for (let x = 0; x < SMALL.width; x++) {
        const over = canopiesOver(x, y, SMALL);
        for (let i = 1; i < over.length; i++) {
          expect(over[i].y).toBeGreaterThanOrEqual(over[i - 1].y);
        }
      }
    }
  });
});

describe('Millbrook', () => {
  const site = SETTLED.village!;

  it('gets sited somewhere in the world', () => {
    expect(site).not.toBeNull();
    expect(site.x).toBeGreaterThan(0);
    expect(site.y).toBeGreaterThan(0);
    expect(site.x + VILLAGE_WIDTH).toBeLessThan(SMALL.width);
    expect(site.y + VILLAGE_HEIGHT).toBeLessThan(SMALL.height);
  });

  it('is sited deterministically', () => {
    expect(findVillageSite(SMALL)).toEqual(site);
  });

  it('stands on ground it could plausibly have been built on', () => {
    // The scan pays -8 a tile for rock, so a site full of cliff loses to any
    // meadow. A couple of clipped tiles is fine; a village in a quarry is not.
    let rock = 0;
    for (let y = site.y; y < site.y + VILLAGE_HEIGHT; y++) {
      for (let x = site.x; x < site.x + VILLAGE_WIDTH; x++) {
        const wild = terrainAt(x, y, SMALL);
        if (wild === 'plateau' || wild === 'cliff' || wild === 'wall') rock++;
      }
    }
    expect(rock / (VILLAGE_WIDTH * VILLAGE_HEIGHT)).toBeLessThan(0.05);
  });

  it('replaces the wild terrain only inside its own footprint', () => {
    for (let y = 0; y < SMALL.height; y++) {
      for (let x = 0; x < SMALL.width; x++) {
        const settledTerrain = terrainAt(x, y, SETTLED);
        if (villageCellAt(x, y, site) === null) {
          expect(settledTerrain).toBe(terrainAt(x, y, SMALL));
        } else {
          expect(['plaza', 'square', 'building']).toContain(settledTerrain);
        }
      }
    }
  });

  it('has houses you cannot walk through and a square you can', () => {
    const centre = villageCentre(site);
    expect(terrainAt(centre.x, centre.y, SETTLED)).toBe('building'); // the haystack
    expect(isSolid('building')).toBe(true);
    expect(isSolid('plaza')).toBe(false);

    let open = 0;
    let solid = 0;
    for (let y = site.y; y < site.y + VILLAGE_HEIGHT; y++) {
      for (let x = site.x; x < site.x + VILLAGE_WIDTH; x++) {
        const t = terrainAt(x, y, SETTLED);
        if (t === 'plaza' || t === 'square') open++;
        else if (t === 'building') solid++;
      }
    }
    // Eight 3x6 houses and a 2x2 haystack.
    expect(solid).toBe(8 * 3 * 6 + 4);
    expect(open).toBeGreaterThan(solid * 3);
  });

  it('never sprouts a tree on village ground', () => {
    // Only on ground the village actually claims. Its plan is an ellipse, so
    // the corners of its bounding box are still open country, and a tree
    // standing there is the landscape doing its job.
    for (let y = site.y; y < site.y + VILLAGE_HEIGHT; y++) {
      for (let x = site.x; x < site.x + VILLAGE_WIDTH; x++) {
        if (villageCellAt(x, y, site) === null) continue;
        expect(terrainAt(x, y, SETTLED)).not.toBe('tree');
      }
    }
  });
});

describe('the spawn point honours the opening beat', () => {
  const spawn = findSpawn(SMALL);

  it('puts the player at the foot of a cliff', () => {
    expect(isCliffFoot(spawn.x, spawn.y, SMALL)).toBe(true);
    expect(terrainAt(spawn.x, spawn.y - 1, SMALL)).toBe('cliff');
  });

  it('leaves the player standing on walkable ground with room to move', () => {
    expect(isSolid(terrainAt(spawn.x, spawn.y, SMALL))).toBe(false);
    expect(isSolid(terrainAt(spawn.x, spawn.y + 1, SMALL))).toBe(false);
    expect(isSolid(terrainAt(spawn.x, spawn.y + 2, SMALL))).toBe(false);
  });

  it('is deterministic', () => {
    expect(findSpawn(SMALL)).toEqual(spawn);
  });
});
