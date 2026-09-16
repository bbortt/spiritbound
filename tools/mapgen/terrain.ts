// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * World terrain field.
 *
 * Every tile's terrain is a pure function of its world coordinate and the
 * world seed. Nothing is generated "left to right", nothing is cached, and no
 * tile needs to know about a tile more than {@link CLIFF_FACE_ROWS} rows away.
 * That is the property the chunk streamer depends on: chunk (7, 12) can be
 * generated, or regenerated, without ever having looked at chunk (6, 12).
 *
 * The vocabulary is wild terrain (plateau, cliff face, grass, trail, border
 * wall), woodland (forest floor and the trunks standing in it), and the one
 * built place in the world (village ground and the buildings on it). Widening
 * it further — water, sand, snow — is a palette problem, not a generator one.
 */

import { villageCellAt, type VillageSite } from './village.ts';

export type Terrain =
  | 'plateau'
  | 'cliff'
  | 'grass'
  | 'path'
  | 'wall'
  /** Woodland floor. Walkable — it is the trunks that stop you, not the wood. */
  | 'forest'
  /** The one tile a tree actually stands on. */
  | 'tree'
  /** Trodden ground inside the village. */
  | 'plaza'
  /** The village's paved square. */
  | 'square'
  /** A building's footprint. Solid: this spike has no interiors. */
  | 'building';

/** Terrain the player cannot walk through. The server agrees with this list. */
export function isSolid(terrain: Terrain): boolean {
  return (
    terrain === 'plateau' ||
    terrain === 'cliff' ||
    terrain === 'wall' ||
    terrain === 'tree' ||
    terrain === 'building'
  );
}

/** How many tile rows of cliff face hang below a plateau edge. */
export const CLIFF_FACE_ROWS = 2;

export interface WorldSpec {
  /** Width and height of the world, in tiles. Must be a multiple of chunk size. */
  readonly width: number;
  readonly height: number;
  /** Edge length of one chunk, in tiles. */
  readonly chunkSize: number;
  readonly seed: number;
  /**
   * Where the village stands, in world tiles, or `null` for a world with no
   * village. This is data rather than something `terrainAt` derives, because
   * siting a village means looking at a whole region at once (see
   * `findVillageSite`) and `terrainAt` is not allowed to scan. The exporter
   * sites it once and hands the result back in here.
   */
  readonly village: VillageSite | null;
}

// ── Noise ────────────────────────────────────────────────────────────────────

/** Integer hash → [0, 1). Deterministic across platforms (all 32-bit ops). */
function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Integer hash, for the decisions that want bits rather than a gradient. */
function jitter(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x1b873593) ^ Math.imul(y, 0xcc9e2d51) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Smoothstep, so the lattice does not show as diamonds. */
function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise on a lattice of `period` tiles. */
function valueNoise(
  x: number,
  y: number,
  period: number,
  seed: number,
): number {
  const fx = x / period;
  const fy = y / period;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fade(fx - x0);
  const ty = fade(fy - y0);

  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x0 + 1, y0, seed);
  const n01 = hash2(x0, y0 + 1, seed);
  const n11 = hash2(x0 + 1, y0 + 1, seed);

  const a = n00 + (n10 - n00) * tx;
  const b = n01 + (n11 - n01) * tx;
  return a + (b - a) * ty;
}

/** Fractal value noise, normalised to [0, 1]. */
function fbm(
  x: number,
  y: number,
  period: number,
  seed: number,
  octaves: number,
): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let p = period;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x, y, p, seed + o * 0x9e37) * amp;
    norm += amp;
    amp *= 0.5;
    p /= 2;
  }
  return sum / norm;
}

// ── Fields ───────────────────────────────────────────────────────────────────

/**
 * Lattice period of the highland field, in tiles. Sets how big plateaus are.
 *
 * This is also what decides whether a *window* onto the world looks like the
 * world. Four octaves of value noise cluster hard around 0.5 — the 85th
 * percentile is only ≈0.64 — so at a 96-tile period a 256-tile world is barely
 * two lattice cells wide and can miss every peak: the first cut of this
 * generator put 14.5% plateau in a 1024 world and 0.35% in its own top-left
 * quarter. At 48 the same threshold gives ~12% either way.
 */
const ELEVATION_PERIOD = 48;
/** Above this, the tile is high ground. ≈85th percentile of the field. */
const PLATEAU_LEVEL = 0.64;

/** Lattice period of the trail field. Sets how far apart trails run. */
const TRAIL_PERIOD = 160;
/** Half-width of the band around the 0.5 contour that becomes trail. */
const TRAIL_HALF_WIDTH = 0.012;

/** Lattice period of the moisture field. Sets how big the woods are. */
const MOISTURE_PERIOD = 40;
/** Above this, lowland grows into woodland. */
const FOREST_LEVEL = 0.54;

/**
 * Trees are anchored one per cell of this grid, at a hashed offset inside the
 * cell. That gives them natural-looking spacing without any tile having to ask
 * where its neighbours' trees are — the whole point, since a tile must stay a
 * pure function of its own coordinate.
 *
 * Four tiles, against a three-tile canopy, is what makes the woods read as
 * woods: at five the crowns never touch and the result is a field with trees
 * standing about in it.
 */
const TREE_CELL = 4;
/** Canopy half-width and height above the trunk, in tiles. A tree is 3x3. */
const CANOPY_RADIUS = 1;
const CANOPY_HEIGHT = 2;

function elevation(x: number, y: number, seed: number): number {
  return fbm(x, y, ELEVATION_PERIOD, seed, 4);
}

function isPlateau(x: number, y: number, seed: number): boolean {
  return elevation(x, y, seed) > PLATEAU_LEVEL;
}

/** Moisture, the field the woods grow out of. */
function moisture(x: number, y: number, seed: number): number {
  return fbm(x, y, MOISTURE_PERIOD, seed ^ 0x7f4a7c15, 3);
}

/**
 * Trails are the contour where a second noise field crosses its midpoint, so
 * they meander across the whole world without any global pathfinding — and,
 * crucially, without any tile needing to know where the trail came from.
 */
function onTrailContour(x: number, y: number, seed: number): boolean {
  const n = fbm(x, y, TRAIL_PERIOD, seed ^ 0x5bd1e995, 3);
  return Math.abs(n - 0.5) < TRAIL_HALF_WIDTH;
}

/**
 * The wild terrain at a tile: what the land would be with nobody living on it
 * and nothing growing. This is the field the village is sited against, which
 * is why it is separate from — and never consults — {@link terrainAt}.
 */
export function wildTerrainAt(x: number, y: number, spec: WorldSpec): Terrain {
  if (x < 0 || y < 0 || x >= spec.width || y >= spec.height) return 'wall';

  // A one-tile ring of wall keeps the player inside the world without needing
  // a special case in the collision code.
  if (x === 0 || y === 0 || x === spec.width - 1 || y === spec.height - 1) {
    return 'wall';
  }

  if (isPlateau(x, y, spec.seed)) return 'plateau';

  // Cliff face: the drop hanging off the south edge of high ground. Looking
  // north only is what makes the face appear below the plateau rather than
  // around it, and it is why the read window is bounded.
  for (let d = 1; d <= CLIFF_FACE_ROWS; d++) {
    if (isPlateau(x, y - d, spec.seed)) return 'cliff';
  }

  if (onTrailContour(x, y, spec.seed)) return 'path';

  if (moisture(x, y, spec.seed) > FOREST_LEVEL) return 'forest';

  return 'grass';
}

/**
 * A tree standing at this exact tile, or `null`. `kind` picks which of the
 * palette's tree sprites gets drawn, so the woods are not one sprite repeated.
 */
export interface TreeAnchor {
  readonly x: number;
  readonly y: number;
  readonly kind: number;
}

/** How many distinct tree sprites the palette is expected to offer. */
export const TREE_KINDS = 4;

/**
 * The tree anchored in one cell of the tree grid, or `null` if that cell grew
 * nothing. Pure, O(1), and reads no tile but the candidate's own.
 */
function treeInCell(
  gx: number,
  gy: number,
  spec: WorldSpec,
): TreeAnchor | null {
  const h = jitter(gx, gy, spec.seed ^ 0x068bd5215);
  const x = gx * TREE_CELL + (h % TREE_CELL);
  const y = gy * TREE_CELL + ((h >>> 8) % TREE_CELL);

  // Only the woods grow trees, and only on ground a tree could root in. This
  // deliberately asks `wildTerrainAt`: a tree must not sprout inside a house.
  if (wildTerrainAt(x, y, spec) !== 'forest') return null;
  // Leave a scatter of clearings rather than a solid wall of trunks.
  if ((h >>> 16) % 8 === 0) return null;

  return { x, y, kind: (h >>> 20) % TREE_KINDS };
}

/** The tree standing exactly at `(x, y)`, if any. */
export function treeAt(
  x: number,
  y: number,
  spec: WorldSpec,
): TreeAnchor | null {
  const tree = treeInCell(
    Math.floor(x / TREE_CELL),
    Math.floor(y / TREE_CELL),
    spec,
  );
  return tree && tree.x === x && tree.y === y ? tree : null;
}

/**
 * Every tree whose canopy covers `(x, y)`, nearest-last so the caller can draw
 * them in order. A canopy is {@link CANOPY_RADIUS} tiles either side of the
 * trunk and {@link CANOPY_HEIGHT} above it, so this only ever inspects the
 * handful of tree cells that could reach this tile.
 */
export function canopiesOver(
  x: number,
  y: number,
  spec: WorldSpec,
): TreeAnchor[] {
  const found: TreeAnchor[] = [];
  const gx0 = Math.floor((x - CANOPY_RADIUS) / TREE_CELL);
  const gx1 = Math.floor((x + CANOPY_RADIUS) / TREE_CELL);
  const gy0 = Math.floor(y / TREE_CELL);
  const gy1 = Math.floor((y + CANOPY_HEIGHT) / TREE_CELL);

  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const tree = treeInCell(gx, gy, spec);
      if (!tree) continue;
      if (Math.abs(tree.x - x) > CANOPY_RADIUS) continue;
      if (tree.y < y || tree.y > y + CANOPY_HEIGHT) continue;
      found.push(tree);
    }
  }

  // Trees lower on the screen overlap those behind them.
  found.sort((a, b) => a.y - b.y);
  return found;
}

/**
 * The terrain at one world tile: the wild field, with the village stamped over
 * it and the woods' trunks standing in it.
 *
 * Reads at most {@link CLIFF_FACE_ROWS} rows north of `(x, y)` for the cliff
 * face, and the tree cell around it for a trunk. Out-of-world coordinates read
 * as `wall`.
 */
export function terrainAt(x: number, y: number, spec: WorldSpec): Terrain {
  const built = spec.village && villageCellAt(x, y, spec.village);
  if (built === 'solid') return 'building';
  if (built === 'paved') return 'square';
  if (built === 'open') return 'plaza';

  const wild = wildTerrainAt(x, y, spec);
  if (wild === 'forest' && treeAt(x, y, spec)) return 'tree';
  return wild;
}

/** True where a tile is the first walkable row under a cliff — the scree line. */
export function isCliffFoot(x: number, y: number, spec: WorldSpec): boolean {
  return (
    terrainAt(x, y, spec) !== 'cliff' && terrainAt(x, y - 1, spec) === 'cliff'
  );
}

/**
 * The spawn point: the opening beat wants the player to wake at the foot of a
 * cliff, so this walks out from the world centre and returns the first
 * cliff-foot tile it finds, in a deterministic spiral.
 *
 * This is the one place in the generator that scans, and it is called once per
 * world build — not per chunk.
 */
export function findSpawn(spec: WorldSpec): { x: number; y: number } {
  const cx = Math.floor(spec.width / 2);
  const cy = Math.floor(spec.height / 2);
  const maxR = Math.max(spec.width, spec.height);

  for (let r = 0; r < maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Only the ring, not the filled square — the interior was covered by
        // a smaller r already.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        // Two clear rows below, so the player does not wake inside a wall.
        if (
          isCliffFoot(x, y, spec) &&
          !isSolid(terrainAt(x, y + 1, spec)) &&
          !isSolid(terrainAt(x, y + 2, spec))
        ) {
          return { x, y };
        }
      }
    }
  }

  throw new Error('no cliff-foot spawn found in world');
}
