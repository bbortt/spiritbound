// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Terrain → tileset mapping.
 *
 * Two sheets, because no single free sheet had everything. The LPC Mountains
 * sheet has the only convincing cliff face; it has no trees and no buildings.
 * The LPC outdoor base atlas has the trees and the buildings and no cliff. So
 * the map carries both, which is what Tiled's `firstgid` and Phaser's
 * multi-tileset support are for. See `client/public/tiles/README.md` for what
 * that costs in licence terms.
 *
 * The generator in `terrain.ts` has no idea any of this exists. Swapping art
 * means rewriting this file and nothing else.
 */

import { type Terrain } from './terrain.ts';

/** Source tile size in the sheets, in pixels. Both are 32. */
export const SRC_TILE = 32;
/** Rendered tile size in world units. 48 / 32 = a 1.5x render scale. */
export const WORLD_TILE = 48;

/** Tiled reserves gid 0 for "empty", so the first sheet starts at 1. */
export const FIRST_GID = 1;

export type SheetId = 'mountains' | 'outdoor';

export interface Sheet {
  readonly id: SheetId;
  readonly name: string;
  readonly image: string;
  readonly columns: number;
  readonly rows: number;
  /** gid of this sheet's tile (0, 0). */
  readonly firstGid: number;
}

const MOUNTAINS: Sheet = {
  id: 'mountains',
  name: 'mountains',
  image: 'mountains-v6.png',
  columns: 64,
  rows: 80,
  firstGid: FIRST_GID,
};

const OUTDOOR: Sheet = {
  id: 'outdoor',
  name: 'outdoor',
  image: 'base_out_atlas.png',
  columns: 32,
  rows: 32,
  firstGid: FIRST_GID + MOUNTAINS.columns * MOUNTAINS.rows,
};

export const SHEETS: readonly Sheet[] = [MOUNTAINS, OUTDOOR];

export function sheetOf(id: SheetId): Sheet {
  return id === 'mountains' ? MOUNTAINS : OUTDOOR;
}

export function tileCount(sheet: Sheet): number {
  return sheet.columns * sheet.rows;
}

/** Sheet coordinate → global tile id, the number that goes in a layer. */
export function gid(sheet: Sheet, col: number, row: number): number {
  return sheet.firstGid + row * sheet.columns + col;
}

const m = (col: number, row: number): number => gid(MOUNTAINS, col, row);

// ── Wild terrain, from the mountains sheet ───────────────────────────────────

const GRASS = [m(1, 72), m(2, 72), m(1, 73), m(2, 73)];
const PLATEAU = [m(17, 42), m(18, 42), m(17, 43), m(18, 43)];
const PLATEAU_ROCK = [
  m(14, 42),
  m(15, 42),
  m(16, 42),
  m(14, 43),
  m(15, 43),
  m(16, 43),
];
const CLIFF_FACE = [m(1, 42), m(2, 42), m(3, 42), m(4, 42)];
/** Vegetation-and-scree fringe, drawn as overlay so grass shows through. */
const CLIFF_FOOT = [m(1, 43), m(2, 43), m(3, 43), m(4, 43)];
const WALL = [m(2, 53), m(3, 53), m(2, 54), m(3, 54)];
const BOULDER = [m(12, 72), m(12, 73)];

/** Cobbled trail, as a 3x3 patch: west/centre/east by north/centre/south. */
const PATH_COL0 = 24;
const PATH_ROW0 = 74;
/** The middle of that patch — bare earth, which is what a village tramples. */
const TRODDEN = m(PATH_COL0 + 1, PATH_ROW0 + 1);

// ── Sprites, from the outdoor atlas ──────────────────────────────────────────

/**
 * A multi-tile sprite. `tiles` is one array per tile row; each entry is the
 * gid to draw, or 0 where the sprite is transparent — a pine's top corners,
 * for instance.
 *
 * Sprites exist because a tree and a house are not tiles. They are pictures
 * several tiles across whose pieces only mean anything in the right
 * arrangement, so the palette stores the arrangement rather than making the
 * caller guess it.
 */
export interface Sprite {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly (readonly number[])[];
}

/** A sprite cut as a plain rectangle out of a sheet. */
function rect(
  sheet: Sheet,
  col: number,
  row: number,
  width: number,
  height: number,
  blank: readonly (readonly [number, number])[] = [],
): Sprite {
  const isBlank = (dx: number, dy: number): boolean =>
    blank.some(([bx, by]) => bx === dx && by === dy);
  const tiles: number[][] = [];
  for (let dy = 0; dy < height; dy++) {
    const out: number[] = [];
    for (let dx = 0; dx < width; dx++) {
      out.push(isBlank(dx, dy) ? 0 : gid(sheet, col + dx, row + dy));
    }
    tiles.push(out);
  }
  return { width, height, tiles };
}

/** A sprite assembled from scattered sheet coordinates. `null` draws nothing. */
function compose(
  sheet: Sheet,
  rows: readonly (readonly (readonly [number, number] | null)[])[],
): Sprite {
  const tiles = rows.map((r) =>
    r.map((cell) => (cell === null ? 0 : gid(sheet, cell[0], cell[1]))),
  );
  return { width: tiles[0].length, height: tiles.length, tiles };
}

/** The gid a sprite draws at one of its own cells, or 0 for nothing. */
export function spriteGid(sprite: Sprite, dx: number, dy: number): number {
  if (dx < 0 || dy < 0 || dx >= sprite.width || dy >= sprite.height) return 0;
  return sprite.tiles[dy][dx];
}

/**
 * The trees. Two broadleaf, two pine, all 3x3 with the trunk at the bottom
 * centre — `terrain.ts` anchors a tree by its trunk and hangs the rest of the
 * canopy north of it.
 */
export const TREES: readonly Sprite[] = [
  rect(OUTDOOR, 24, 12, 3, 3),
  rect(OUTDOOR, 27, 12, 3, 3),
  rect(OUTDOOR, 24, 15, 3, 3, [
    [0, 0],
    [2, 0],
  ]),
  rect(OUTDOOR, 27, 15, 3, 3, [
    [0, 0],
    [2, 0],
  ]),
];

/**
 * The roof, which every house wears.
 *
 * The atlas draws it as a four-row slate block at columns 0-2, rows 12-15:
 * slates, then a dormer row, then the front gable's peak, and finally the two
 * lower slopes — whose middle tile, (1, 15), is deliberately empty, because
 * that is the hole the house's front wall shows through. Reading rows 14-15 as
 * "the roof" and stopping there, as the first cut of this file did, gets you a
 * house with a notch bitten out of the top of it.
 */
const ROOF: readonly (readonly [number, number])[][] = [
  [
    [0, 12],
    [1, 12],
    [2, 12],
  ],
  [
    [0, 13],
    [1, 13],
    [2, 13],
  ],
  [
    [0, 14],
    [1, 14],
    [2, 14],
  ],
];

/**
 * A house: the roof above, then the gable row whose middle tile is wall, then
 * two rows of wall with a door in them. Six tiles tall, three wide.
 *
 * `wall` is the four tiles the front takes from whichever wall the house is
 * built out of — left and right of the gable row are roof, so only the middle
 * shows — and `door` is the two-tile doorway.
 */
function house(
  gable: readonly [number, number],
  wall: readonly (readonly [number, number])[],
  door: readonly (readonly [number, number])[],
): Sprite {
  return compose(OUTDOOR, [
    ...ROOF,
    [[0, 15], gable, [2, 15]],
    [wall[0], door[0], wall[1]],
    [wall[2], door[1], wall[3]],
  ]);
}

/** Red brick with white quoins, and the same wall in grey stone. */
const BRICK = [
  [0, 10],
  [2, 10],
  [0, 11],
  [2, 11],
] as const;
const STONE = [
  [3, 14],
  [5, 14],
  [3, 15],
  [5, 15],
] as const;

export const HOUSES: readonly Sprite[] = [
  house([1, 9], BRICK, [
    [3, 9],
    [3, 10],
  ]),
  house([1, 9], BRICK, [
    [5, 9],
    [5, 10],
  ]),
  house([4, 13], STONE, [
    [5, 9],
    [5, 10],
  ]),
];

/** The haystack in the middle of the square. */
export const HAYSTACK: Sprite = rect(OUTDOOR, 11, 21, 2, 2);

/**
 * Flagstones, for the one piece of ground in the world somebody paved.
 *
 * Both tiles are from the atlas's sandstone set. The sage-grey set sits
 * directly under it and is tempting for variety, but mixing the two families
 * gives a square that looks like two different squares shuffled together — and
 * at any distance the grey reads as water against this much green.
 */
const FLAGSTONE = [gid(OUTDOOR, 20, 22), gid(OUTDOOR, 21, 22)];

/**
 * Every gid whose tile blocks movement, for the `collides` property Tiled
 * carries and `setCollisionByProperty` reads.
 *
 * The client's tilemap is presentation only — the authority is the walkability
 * bitmask in `walkability.ts` — but a tilemap that disagrees with the server
 * about walls is a bug waiting to happen, so it is flagged honestly.
 */
export const SOLID_GIDS: readonly number[] = [
  ...new Set([
    ...PLATEAU,
    ...PLATEAU_ROCK,
    ...CLIFF_FACE,
    ...WALL,
    ...HOUSES.flatMap((h) => h.tiles.flat()).filter((g) => g !== 0),
    ...HAYSTACK.tiles.flat().filter((g) => g !== 0),
  ]),
].sort((a, b) => a - b);

/** Deterministic per-tile variation, so the same world always looks the same. */
function jitter(x: number, y: number, salt: number): number {
  let h = Math.imul(x, 0x1b873593) ^ Math.imul(y, 0xcc9e2d51) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  return (h ^ (h >>> 16)) >>> 0;
}

function pick(from: readonly number[], x: number, y: number, salt = 0): number {
  return from[jitter(x, y, salt) % from.length];
}

/** Opaque base tile for a terrain. Returns a gid. */
export function groundTile(terrain: Terrain, x: number, y: number): number {
  switch (terrain) {
    case 'plateau':
      return jitter(x, y, 0x11) % 4 === 0
        ? pick(PLATEAU_ROCK, x, y, 0x12)
        : pick(PLATEAU, x, y, 0x13);
    case 'cliff':
      return pick(CLIFF_FACE, x, y, 0x21);
    case 'wall':
      return pick(WALL, x, y, 0x31);
    case 'square':
      return pick(FLAGSTONE, x, y, 0x71);
    case 'plaza':
    case 'building':
      // Buildings stand on the village's own ground, and the sprite covers it.
      return TRODDEN;
    // The trail is painted on the overlay layer so its transparent edges let
    // the grass underneath show through. Woodland floor is grass too — it is
    // the canopies that make it read as wood.
    case 'path':
    case 'grass':
    case 'forest':
    case 'tree':
      return pick(GRASS, x, y, 0x41);
  }
}

/**
 * The trail piece for a tile, edge-matched against its neighbours so the trail
 * gets a border instead of a hard seam. `neighbour` answers "is that tile also
 * trail?" and is only ever asked about the four orthogonal neighbours.
 */
export function pathTile(
  x: number,
  y: number,
  neighbour: (nx: number, ny: number) => boolean,
): number {
  const col = !neighbour(x - 1, y) ? 0 : !neighbour(x + 1, y) ? 2 : 1;
  const row = !neighbour(x, y - 1) ? 0 : !neighbour(x, y + 1) ? 2 : 1;
  return m(PATH_COL0 + col, PATH_ROW0 + row);
}

/** Scree-and-vegetation fringe drawn over the first walkable row under a cliff. */
export function cliffFootTile(x: number): number {
  return CLIFF_FOOT[x % CLIFF_FOOT.length];
}

/** A shed boulder. Decoration only — it does not block. */
export function boulderTile(x: number, y: number): number {
  return pick(BOULDER, x, y, 0x51);
}

/** Boulders are sparse: roughly one per this many eligible tiles. */
export const BOULDER_RARITY = 140;

export function hasBoulder(x: number, y: number): boolean {
  return jitter(x, y, 0x61) % BOULDER_RARITY === 0;
}
