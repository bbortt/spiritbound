// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Terrain → tileset mapping, CC0 edition.
 *
 * Two sheets again, but split for a different reason than before. The LPC
 * pair was split by content — one had cliffs, the other had trees. This pair
 * is split by provenance: everything Kenney's CC0 Roguelike/RPG pack could
 * supply comes from `roguelike-sheet.png`, and the one thing it could not —
 * a cliff — is drawn by `cliffArt.ts` into `cliff-cc0.png`.
 *
 * That split is the whole finding. Kenney's pack has grass, dirt, stone,
 * sand, water, paths, trees, bushes, boulders, walls and houses. It has no
 * elevation of any kind: no cliff face, no plateau edge, no mountain. Its
 * only vertical surfaces are buildings. See `client/public/tiles/README.md`.
 *
 * Both sheets are 16 px, so `SRC_TILE` dropped from 32 to 16 and the render
 * scale went from 1.5x to a clean 3x. Kenney's sheet carries a 1 px gutter
 * between tiles, which is why `Sheet` now has a `spacing` field and why
 * `tmj.ts` stopped hardcoding zero.
 *
 * The generator in `terrain.ts` still has no idea any of this exists.
 */

import {
  CLIFF_COLS,
  CLIFF_FACE_ROW,
  CLIFF_FOOT_ROW,
  CLIFF_LIP_ROW,
  CLIFF_ROWS,
} from './cliffArt.ts';
import { type Terrain } from './terrain.ts';

/** Source tile size in the sheets, in pixels. Both are 16. */
export const SRC_TILE = 16;
/** Rendered tile size in world units. 48 / 16 = a 3x render scale. */
export const WORLD_TILE = 48;

/** Tiled reserves gid 0 for "empty", so the first sheet starts at 1. */
export const FIRST_GID = 1;

export type SheetId = 'kenney' | 'cliff';

export interface Sheet {
  readonly id: SheetId;
  readonly name: string;
  readonly image: string;
  readonly columns: number;
  readonly rows: number;
  /** Pixels between adjacent tiles. Kenney ships a 1 px gutter; ours has none. */
  readonly spacing: number;
  /** Pixels between the image edge and the first tile. */
  readonly margin: number;
  /** gid of this sheet's tile (0, 0). */
  readonly firstGid: number;
}

const KENNEY: Sheet = {
  id: 'kenney',
  name: 'kenney',
  image: 'kenney/roguelike-sheet.png',
  columns: 57,
  rows: 31,
  spacing: 1,
  margin: 0,
  firstGid: FIRST_GID,
};

const CLIFF: Sheet = {
  id: 'cliff',
  name: 'cliff',
  image: 'cliff-cc0.png',
  columns: CLIFF_COLS,
  rows: CLIFF_ROWS,
  spacing: 0,
  margin: 0,
  firstGid: FIRST_GID + 57 * 31,
};

export const SHEETS: readonly Sheet[] = [KENNEY, CLIFF];

export function sheetOf(id: SheetId): Sheet {
  return id === 'kenney' ? KENNEY : CLIFF;
}

export function tileCount(sheet: Sheet): number {
  return sheet.columns * sheet.rows;
}

/** Sheet coordinate → global tile id, the number that goes in a layer. */
export function gid(sheet: Sheet, col: number, row: number): number {
  return sheet.firstGid + row * sheet.columns + col;
}

/** Which sheet owns a gid. */
export function sheetForGid(g: number): Sheet | null {
  for (let i = SHEETS.length - 1; i >= 0; i--) {
    const s = SHEETS[i];
    if (g >= s.firstGid && g < s.firstGid + tileCount(s)) return s;
  }
  return null;
}

/** Pixel origin of a tile within its sheet image, gutter accounted for. */
export function tilePixel(
  sheet: Sheet,
  col: number,
  row: number,
): { x: number; y: number } {
  return {
    x: sheet.margin + col * (SRC_TILE + sheet.spacing),
    y: sheet.margin + row * (SRC_TILE + sheet.spacing),
  };
}

/** Full pixel size of a sheet image, gutter accounted for. */
export function sheetPixels(sheet: Sheet): {
  width: number;
  height: number;
} {
  const span = (n: number): number =>
    sheet.margin * 2 + n * SRC_TILE + (n - 1) * sheet.spacing;
  return { width: span(sheet.columns), height: span(sheet.rows) };
}

const k = (col: number, row: number): number => gid(KENNEY, col, row);
const c = (col: number, row: number): number => gid(CLIFF, col, row);

// ── Wild terrain, from Kenney's sheet ────────────────────────────────────────

/**
 * Plain grass, in its two near-identical shades.
 *
 * Kenney's pale-blotched variant at (9, 1) is deliberately left out. Scattered
 * through a field at a 3x render scale it does not read as grass texture, it
 * reads as lichen — or, at a glance, as snow.
 */
const GRASS = [k(5, 0), k(5, 1)];
/**
 * The plateau is Kenney's plain sand, not grass — the vale floor is already
 * green, and a green clifftop above a green floor reads as one flat field
 * with a grey stripe through it rather than as height.
 *
 * It is also uniform. Kenney's ground tiles are flat colour fills with no
 * edge blending, so mixing a second one in at random does not read as rocky
 * ground; it reads as a chequerboard. Variation on the plateau comes from
 * boulders on the overlay instead, which have their own transparent edges.
 */
const PLATEAU = [k(8, 0), k(8, 1)];
/** Grey masonry, for the walls the village puts up. */
const WALL = [k(6, 2), k(6, 3)];
/** Loose rock, drawn on the overlay so grass shows through around it. */
const BOULDER = [
  k(54, 21),
  k(55, 21),
  k(56, 21),
  k(54, 22),
  k(55, 22),
  k(56, 22),
];

/**
 * The trail, a 3x3 edge-matched patch of Kenney's dirt.
 *
 * Kenney's terrain sets are laid out as organic blobs rather than a tidy Wang
 * grid, but one clean 3x3 falls out of the dirt set at columns 7-9, rows
 * 9-11: outer corners on the corners, edges on the sides, fill in the middle.
 * That is exactly the shape `pathTile` wants. The grey set repeats the same
 * arrangement six rows down, at rows 15-17, if a stone road ever wants one.
 */
const PATH_COL0 = 7;
const PATH_ROW0 = 9;
/** The middle of that patch — bare earth, what the village tramples. */
const TRODDEN = k(PATH_COL0 + 1, PATH_ROW0 + 1);

// ── The cliff, from our own sheet ────────────────────────────────────────────

/** The drop itself. */
const CLIFF_FACE = [
  c(0, CLIFF_FACE_ROW),
  c(1, CLIFF_FACE_ROW),
  c(2, CLIFF_FACE_ROW),
  c(3, CLIFF_FACE_ROW),
];
/** The top edge, where the plateau surface breaks into the face. */
export const CLIFF_LIP = [
  c(0, CLIFF_LIP_ROW),
  c(1, CLIFF_LIP_ROW),
  c(2, CLIFF_LIP_ROW),
  c(3, CLIFF_LIP_ROW),
];
/** Scree fringe, drawn on the overlay so grass shows through. */
const CLIFF_FOOT = [
  c(0, CLIFF_FOOT_ROW),
  c(1, CLIFF_FOOT_ROW),
  c(2, CLIFF_FOOT_ROW),
  c(3, CLIFF_FOOT_ROW),
];

// ── Sprites ─────────────────────────────────────────────────────────────────

/**
 * A multi-tile sprite. `tiles` is one array per tile row; each entry is a gid
 * to draw, or 0 where the sprite is transparent.
 *
 * Sprites exist because a tree or a house is not a tile. They are pictures
 * several tiles across whose pieces only mean anything in the right
 * arrangement, so the palette stores the arrangement rather than making every
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
): Sprite {
  const tiles: number[][] = [];
  for (let dy = 0; dy < height; dy++) {
    const out: number[] = [];
    for (let dx = 0; dx < width; dx++) out.push(gid(sheet, col + dx, row + dy));
    tiles.push(out);
  }
  return { width, height, tiles };
}

/** The gid a sprite draws at one of its own cells, or 0 for nothing. */
export function spriteGid(sprite: Sprite, dx: number, dy: number): number {
  if (dx < 0 || dy < 0 || dx >= sprite.width || dy >= sprite.height) return 0;
  return sprite.tiles[dy][dx];
}

/**
 * The trees: two broadleaf, two pine, all 1 wide and 2 tall with the trunk in
 * the bottom cell.
 *
 * Kenney's trees are a single column where LPC's were 3x3. `terrain.ts`
 * anchors a tree by its trunk and hangs the rest of the canopy north of it,
 * which still works — the canopy is simply one tile instead of eight. The
 * autumn-coloured pair at columns 14 and 17 is left out: Hollow Vale is not
 * having a season.
 */
export const TREES: readonly Sprite[] = [
  rect(KENNEY, 13, 10, 1, 2),
  rect(KENNEY, 15, 10, 1, 2),
  rect(KENNEY, 16, 10, 1, 2),
  rect(KENNEY, 18, 10, 1, 2),
];

/**
 * The houses, seen from above: a 3x3 flat roof in three colours.
 *
 * Kenney draws buildings as a kit of walls, gables and doorways meant to be
 * assembled freely, rather than as whole houses — and most of that kit is
 * drawn for a three-quarter view, where you see the roof *and* the wall under
 * it. Picking the gabled pieces gets you a peak, a body and an eave with a
 * transparent notch cut in the bottom for the wall that is supposed to be
 * there; with nothing under it, a house renders as an arrowhead.
 *
 * These are the flat roofs instead: bordered 3x3 blocks that are complete on
 * their own. Straight down at a roof is also what this camera actually sees.
 */
export const HOUSES: readonly Sprite[] = [
  rect(KENNEY, 17, 21, 3, 3),
  rect(KENNEY, 24, 21, 3, 3),
  rect(KENNEY, 31, 21, 3, 3),
];

/**
 * Heaped mounds, standing in for the haystack.
 *
 * Kenney's pack has no hay. These are its earth piles — four of them, because
 * `village.ts` stamps a 2x2 footprint and a 1x1 sprite in a 2x2 hole leaves
 * three tiles of bare ground around it.
 */
export const HAYSTACK: Sprite = rect(KENNEY, 54, 19, 2, 2);

/**
 * Flagstones, the one piece of ground in the world somebody paved.
 *
 * Kenney's beige brick, the same sandstone family as the plateau, so the
 * square reads as quarried from the cliff above it.
 */
const FLAGSTONE = [k(7, 2), k(7, 3)];

/**
 * Every gid whose tile blocks movement, for the `collides` property Tiled
 * carries and `setCollisionByProperty` reads.
 *
 * This is the client's tilemap presentation only — the authority on
 * walkability is the bitmask in `walkability.ts` — but a tilemap that
 * disagrees with the server about walls is a bug waiting to happen, so it is
 * flagged honestly.
 */
export const SOLID_GIDS: readonly number[] = [
  ...new Set([
    ...PLATEAU,
    ...CLIFF_FACE,
    ...CLIFF_LIP,
    ...WALL,
    ...HOUSES.flatMap((h) => h.tiles.flat()).filter((g) => g > 0),
    ...HAYSTACK.tiles.flat().filter((g) => g > 0),
  ]),
].sort((a, b) => a - b);

/** Cheap per-tile hash, so the same tile always picks the same variant. */
function jitter(x: number, y: number, salt: number): number {
  let h = Math.imul(x, 0x1b873593) ^ Math.imul(y, 0xcc9e2d51) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  return (h ^ (h >>> 16)) >>> 0;
}

function pick(from: readonly number[], x: number, y: number, salt = 0): number {
  return from[jitter(x, y, salt) % from.length];
}

/** The opaque base tile for a terrain. Returns a gid. */
export function groundTile(terrain: Terrain, x: number, y: number): number {
  switch (terrain) {
    case 'plateau':
      return pick(PLATEAU, x, y, 0x13);
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
    // the grass underneath show through. Woodland floor is grass too — the
    // canopies are what make it read as wood.
    case 'path':
    case 'grass':
    case 'forest':
    case 'tree':
      return pick(GRASS, x, y, 0x41);
  }
}

/**
 * The trail piece for a tile, edge-matched to its neighbours so the trail
 * gets a border instead of a hard seam. `neighbour` answers "is that tile
 * also trail?" and is only ever asked about the four orthogonal neighbours.
 */
export function pathTile(
  x: number,
  y: number,
  neighbour: (nx: number, ny: number) => boolean,
): number {
  const col = !neighbour(x - 1, y) ? 0 : !neighbour(x + 1, y) ? 2 : 1;
  const row = !neighbour(x, y - 1) ? 0 : !neighbour(x, y + 1) ? 2 : 1;
  return k(PATH_COL0 + col, PATH_ROW0 + row);
}

/** Scree-and-vegetation fringe at the foot of the cliff. */
export function cliffFootTile(x: number): number {
  return CLIFF_FOOT[x % CLIFF_FOOT.length];
}

export function boulderTile(x: number, y: number): number {
  return pick(BOULDER, x, y, 0x51);
}

const BOULDER_RARITY = 140;

export function hasBoulder(x: number, y: number): boolean {
  return jitter(x, y, 0x61) % BOULDER_RARITY === 0;
}
