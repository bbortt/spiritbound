// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * One chunk's worth of renderable data, derived from the terrain field.
 *
 * A chunk is self-contained: building it touches only its own tiles plus a
 * small apron for edge matching and for the sprites that lean in from the
 * chunk next door, so chunks can be built in any order, on demand, or all at
 * once by the exporter.
 */

import {
  boulderTile,
  cliffFootTile,
  groundTile,
  hasBoulder,
  HAYSTACK,
  HOUSES,
  pathTile,
  spriteGid,
  TREES,
} from './palette.ts';
import {
  canopiesOver,
  isCliffFoot,
  isSolid,
  terrainAt,
  type Terrain,
  type WorldSpec,
} from './terrain.ts';
import { villageSpriteAt } from './village.ts';

export interface ChunkData {
  readonly cx: number;
  readonly cy: number;
  /** World tile coordinate of the chunk's top-left tile. */
  readonly originX: number;
  readonly originY: number;
  readonly size: number;
  /** Row-major gids, `size * size` long. 0 means empty. */
  readonly ground: number[];
  readonly overlay: number[];
  readonly above: number[];
  /** Row-major terrain, the source of truth for collision. */
  readonly terrain: Terrain[];
}

export function chunkCountX(spec: WorldSpec): number {
  return Math.ceil(spec.width / spec.chunkSize);
}

export function chunkCountY(spec: WorldSpec): number {
  return Math.ceil(spec.height / spec.chunkSize);
}

export function buildChunk(cx: number, cy: number, spec: WorldSpec): ChunkData {
  const size = spec.chunkSize;
  const originX = cx * size;
  const originY = cy * size;

  const ground: number[] = new Array(size * size);
  const overlay: number[] = new Array(size * size).fill(0);
  const above: number[] = new Array(size * size).fill(0);
  const terrain: Terrain[] = new Array(size * size);

  const isPath = (nx: number, ny: number): boolean =>
    terrainAt(nx, ny, spec) === 'path';

  for (let ly = 0; ly < size; ly++) {
    for (let lx = 0; lx < size; lx++) {
      const i = ly * size + lx;
      const x = originX + lx;
      const y = originY + ly;

      const t = terrainAt(x, y, spec);
      terrain[i] = t;
      ground[i] = groundTile(t, x, y);

      if (t === 'path') {
        overlay[i] = pathTile(x, y, isPath);
      } else if (isCliffFoot(x, y, spec)) {
        overlay[i] = cliffFootTile(x);
      }

      above[i] = aboveTile(x, y, t, overlay[i], spec);
    }
  }

  return { cx, cy, originX, originY, size, ground, overlay, above, terrain };
}

/**
 * The top layer: everything the player can walk behind, plus the structures
 * that are simply in the way.
 *
 * One tile can only hold one gid, so where two canopies overlap the nearer one
 * wins and the further one loses its edge. That is what makes a wood look like
 * a wood — crowns cutting into each other — and only turns into a visible hole
 * where three trees land on top of one another. A fix would mean a fourth
 * layer, which is not worth the file size in a spike.
 */
function aboveTile(
  x: number,
  y: number,
  terrain: Terrain,
  overlay: number,
  spec: WorldSpec,
): number {
  const built = spec.village && villageSpriteAt(x, y, spec.village);
  if (built) {
    const sprite =
      built.what === 'haystack' ? HAYSTACK : HOUSES[built.kind % HOUSES.length];
    const drawn = spriteGid(sprite, built.dx, built.dy);
    if (drawn !== 0) return drawn;
  }

  // Canopies come back nearest-last, so the last one that actually draws
  // something is the one in front.
  const canopies = canopiesOver(x, y, spec);
  for (let i = canopies.length - 1; i >= 0; i--) {
    const tree = canopies[i];
    const sprite = TREES[tree.kind % TREES.length];
    const drawn = spriteGid(
      sprite,
      x - tree.x + 1,
      y - tree.y + sprite.height - 1,
    );
    if (drawn !== 0) return drawn;
  }

  // Boulders ride the top layer so the player walks behind them. They are
  // decoration, never collision — the terrain underneath stays walkable. They
  // stop at the village edge: somebody would have cleared them.
  const inVillage =
    terrain === 'plaza' || terrain === 'square' || terrain === 'building';
  if (!inVillage && !isSolid(terrain) && overlay === 0 && hasBoulder(x, y)) {
    return boulderTile(x, y);
  }

  return 0;
}
