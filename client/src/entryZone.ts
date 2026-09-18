// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Entry-zone tilemap (Hollow Vale).
 *
 * The opening beat in `docs/GAME_DESIGN.md` — "it threw you off a cliff, you
 * wake at the bottom with nothing" — needs the cliff to be visible from the
 * spawn point, so the map's north band is a plateau that drops into the vale
 * the player wakes in.
 *
 * This module is pure data: it produces a semantic terrain grid (what a tile
 * *is*, which drives collision) and two index grids into the tileset image
 * (what a tile *looks like*). Keeping them apart means the art can be swapped
 * without touching movement, and the whole thing stays unit-testable without
 * Phaser.
 */

export const TILE_SIZE = 48; // world units per tile
export const MAP_W = 60;
export const MAP_H = 60;

export const WORLD_W = MAP_W * TILE_SIZE; // 2880
export const WORLD_H = MAP_H * TILE_SIZE; // 2880

/** Source tile size of the tileset images, before they are scaled to TILE_SIZE. */
export const SRC_TILE = 16;

/**
 * The zone draws from two sheets, so tiles are Tiled-style global ids rather
 * than plain indices: Kenney's CC0 pack owns the first block, and the cliff
 * sheet we draw ourselves takes over above it. `GameScene` hands both to
 * `addTilesetImage` with these same gids, which is what makes one flat number
 * grid address two textures.
 *
 * Kenney's sheet also carries a 1 px gutter between tiles — hence `SPACING`,
 * which the scene passes to Phaser and without which every tile is drawn one
 * pixel off, worsening as you go right and down.
 */
export const KENNEY_COLS = 57;
export const KENNEY_ROWS = 31;
export const KENNEY_SPACING = 1;
export const KENNEY_FIRST_GID = 1;

export const CLIFF_COLS = 8;
export const CLIFF_ROWS_TOTAL = 3;
export const CLIFF_SPACING = 0;
export const CLIFF_FIRST_GID = KENNEY_FIRST_GID + KENNEY_COLS * KENNEY_ROWS;

/** Empty cell in the overlay layer. */
export const EMPTY = -1;

export type Terrain = 'plateau' | 'cliff' | 'grass' | 'path' | 'wall';

/** North band layout, in tile rows from the top edge. */
const PLATEAU_ROWS = 3; // the high ground you were thrown from
const FACE_ROWS = 2; // the drop itself
const CLIFF_ROWS = PLATEAU_ROWS + FACE_ROWS;
/** First walkable row: the rubble fringe at the foot of the cliff. */
const CLIFF_FOOT_ROW = CLIFF_ROWS;

/** Sheet coordinates, as (column, row), resolved to a global tile id. */
const tile = (col: number, row: number): number =>
  KENNEY_FIRST_GID + row * KENNEY_COLS + col;
const cliff = (col: number, row: number): number =>
  CLIFF_FIRST_GID + row * CLIFF_COLS + col;

/**
 * Plain grass, in its two near-identical shades. Kenney's pale-blotched
 * variant at (9, 1) is left out: scattered through a field at a 3x render
 * scale it reads as lichen, or at a glance as snow.
 */
const GRASS = [tile(5, 0), tile(5, 1)];
/**
 * Sand, not grass, for the clifftop: a green plateau above a green vale floor
 * reads as one flat field with a grey stripe across it rather than as height.
 *
 * Uniform, too. Kenney's ground tiles are flat fills with no edge blending, so
 * mixing a stone tile in at random reads as a chequerboard rather than as
 * rocky ground; the boulders on the overlay do that job instead.
 */
const PLATEAU = [tile(8, 0), tile(8, 1)];
const cliffRow = (row: number): number[] =>
  Array.from({ length: CLIFF_COLS }, (_, col) => cliff(col, row));

/** The lip where the plateau surface breaks over into the drop. */
const CLIFF_LIP = cliffRow(0);
const CLIFF_FACE = cliffRow(1);
/** Scree fringe; drawn as an overlay so the grass shows through it. */
const CLIFF_FOOT = cliffRow(2);
const WALL = [tile(6, 2), tile(6, 3)];
const BOULDER = [tile(54, 21), tile(55, 21), tile(56, 21), tile(54, 22)];

/**
 * Dirt trail, as a 3x3 patch: column picks the west/centre/east piece and row
 * the north/centre/south one, so the trail gets a proper edge instead of a
 * hard tile seam. The tiles are partly transparent, so the grass underneath
 * shows through the gaps.
 *
 * Kenney lays its terrain out as organic blobs rather than a Wang grid, but
 * one clean 3x3 falls out of the dirt set here.
 */
const PATH_COL0 = 7;
const PATH_ROW0 = 9;

/** Waypoints of the trail through the vale, in tile coordinates. */
const TRAIL: readonly (readonly [number, number])[] = [
  [1, 30],
  [12, 25],
  [20, 38],
  [30, 30],
  [38, 18],
  [46, 34],
  [54, 28],
  [58, 30],
];

/** Boulders shed by the cliff, in tile coordinates. Decoration only. */
const SCREE: readonly (readonly [number, number])[] = [
  [6, 7],
  [7, 8],
  [14, 6],
  [23, 7],
  [31, 8],
  [40, 6],
  [48, 7],
  [52, 9],
  [18, 12],
  [35, 13],
];

export interface EntryZone {
  /** What each tile is — the source of truth for collision. */
  terrain: Terrain[][];
  /** Tileset indices for the opaque base layer. */
  ground: number[][];
  /** Tileset indices for the layer drawn on top, or EMPTY. */
  overlay: number[][];
}

export function isSolid(terrain: Terrain): boolean {
  return terrain === 'plateau' || terrain === 'cliff' || terrain === 'wall';
}

/** Seeded PRNG, so tile variation is scattered but identical on every load. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function trailTiles(): Set<string> {
  const cells = new Set<string>();
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const [x0, y0] = TRAIL[i];
    const [x1, y1] = TRAIL[i + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = Math.round(x0 + (x1 - x0) * t);
      const cy = Math.round(y0 + (y1 - y0) * t);
      // 3-wide brush, kept clear of the border ring and the cliff.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (
            nx > 0 &&
            nx < MAP_W - 1 &&
            ny > CLIFF_FOOT_ROW &&
            ny < MAP_H - 1
          ) {
            cells.add(`${nx},${ny}`);
          }
        }
      }
    }
  }
  return cells;
}

export function buildEntryZone(): EntryZone {
  const rnd = mulberry32(0x5b17);
  const pick = (from: readonly number[]): number =>
    from[Math.floor(rnd() * from.length)];

  const trail = trailTiles();
  const onTrail = (x: number, y: number): boolean => trail.has(`${x},${y}`);

  const terrain: Terrain[][] = [];
  const ground: number[][] = [];
  const overlay: number[][] = [];

  for (let y = 0; y < MAP_H; y++) {
    const terrainRow: Terrain[] = [];
    const groundRow: number[] = [];
    const overlayRow: number[] = [];

    for (let x = 0; x < MAP_W; x++) {
      const border = x === 0 || x === MAP_W - 1 || y === MAP_H - 1;

      if (y < PLATEAU_ROWS) {
        terrainRow.push('plateau');
        groundRow.push(pick(PLATEAU));
      } else if (y === PLATEAU_ROWS) {
        // The break itself: half plateau surface, half face, so the drop has
        // an edge to it rather than starting flat against flat.
        terrainRow.push('cliff');
        groundRow.push(CLIFF_LIP[x % CLIFF_LIP.length]);
      } else if (y < CLIFF_ROWS) {
        terrainRow.push('cliff');
        groundRow.push(pick(CLIFF_FACE));
      } else if (border) {
        terrainRow.push('wall');
        groundRow.push(pick(WALL));
      } else if (onTrail(x, y)) {
        terrainRow.push('path');
        groundRow.push(pick(GRASS));
      } else {
        terrainRow.push('grass');
        groundRow.push(pick(GRASS));
      }

      overlayRow.push(EMPTY);
    }

    terrain.push(terrainRow);
    ground.push(groundRow);
    overlay.push(overlayRow);
  }

  // Fringe where the cliff meets the vale, drawn over the grass.
  for (let x = 0; x < MAP_W; x++) {
    overlay[CLIFF_FOOT_ROW][x] = CLIFF_FOOT[x % CLIFF_FOOT.length];
  }

  // The trail, edge-matched against its own neighbours.
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (terrain[y][x] !== 'path') continue;
      const col = !onTrail(x - 1, y) ? 0 : !onTrail(x + 1, y) ? 2 : 1;
      const row = !onTrail(x, y - 1) ? 0 : !onTrail(x, y + 1) ? 2 : 1;
      overlay[y][x] = tile(PATH_COL0 + col, PATH_ROW0 + row);
    }
  }

  for (const [x, y] of SCREE) {
    overlay[y][x] = pick(BOULDER);
  }

  return { terrain, ground, overlay };
}
