// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Millbrook — the one place in Hollow Vale somebody built.
 *
 * Everything else in this exporter is a noise field: ask it about a tile and
 * it answers without knowing the tile next door. A village cannot work that
 * way. A row of houses is a *composition* — the roof has to sit on the walls,
 * the door has to face the square, the well has to be in the middle of
 * something. So this module is hand-authored: a small fixed layout, stamped
 * into the world at a site the exporter picks once.
 *
 * The rest of the generator stays pure because of how the two meet. The layout
 * below is a constant, the site is a constant by the time any tile is drawn
 * (it lives in `WorldSpec.village`), and so `villageCellAt` is still a pure
 * O(1) function of a world coordinate. Chunks stay independent.
 *
 * Buildings are solid all the way through. There are no interiors in this
 * spike, so a door is a thing you look at, not a thing you walk through.
 */

/** Where the village's top-left corner sits, in world tiles. */
export interface VillageSite {
  readonly x: number;
  readonly y: number;
}

/** What a village tile does to movement, and what it is paved with. */
export type VillageCell = 'solid' | 'paved' | 'open';

/**
 * The ground the village stands on.
 *
 * `,` cobbled square, `.` trodden ground, ` ` untouched — the world's own
 * terrain shows through the spaces, which is what keeps the village looking
 * dropped into the landscape rather than punched out of it.
 *
 * Note what is *not* here: buildings. A structure's footprint is derived from
 * the sprite stamp that draws it ({@link BUILDINGS}, {@link HAYSTACK}), never
 * drawn twice — an earlier cut of this file kept `#` blocks in the plan as
 * well, and the two drifted apart immediately.
 */
const GROUND = [
  '         ............         ',
  '       ................       ',
  '      ..................      ',
  '    ......................    ',
  '   ........................   ',
  '   ........................   ',
  '  ..........................  ',
  ' ............................ ',
  ' ............................ ',
  ' ........,,,,,,,,,,,,........ ',
  '.........,,,,,,,,,,,,.........',
  '.........,,,,,,,,,,,,.........',
  '.........,,,,,,,,,,,,.........',
  '.........,,,,,,,,,,,,.........',
  '.........,,,,,,,,,,,,.........',
  '.........,,,,,,,,,,,,.........',
  ' ........,,,,,,,,,,,,........ ',
  ' ........,,,,,,,,,,,,........ ',
  ' ........,,,,,,,,,,,,........ ',
  '  ..........................  ',
  '   ........................   ',
  '   ........................   ',
  '    ......................    ',
  '      ..................      ',
  '       ................       ',
  '         ............         ',
] as const;

export const VILLAGE_WIDTH = GROUND[0].length;
export const VILLAGE_HEIGHT = GROUND.length;

/**
 * A building: which stamp to draw and where its top-left tile goes, in
 * village-local coordinates. `kind` indexes the palette's house sprites.
 */
export interface Building {
  readonly x: number;
  readonly y: number;
  readonly kind: number;
}

/** How many distinct house sprites the palette is expected to offer. */
export const HOUSE_KINDS = 3;

/**
 * Footprint of every house stamp, in tiles: four rows of roof down to the
 * gable, then two of wall with the door in them. See `palette.ts` for how the
 * atlas's roof pieces assemble into that.
 */
export const HOUSE_WIDTH = 3;
export const HOUSE_HEIGHT = 6;

/** The houses, north row first — two on each side of the square. */
export const BUILDINGS: readonly Building[] = [
  { x: 9, y: 1, kind: 0 },
  { x: 16, y: 1, kind: 1 },
  { x: 4, y: 8, kind: 2 },
  { x: 22, y: 8, kind: 1 },
  { x: 4, y: 14, kind: 0 },
  { x: 22, y: 14, kind: 2 },
  { x: 9, y: 20, kind: 1 },
  { x: 16, y: 20, kind: 0 },
];

/** The haystack in the middle of the square, in village-local tiles. */
export const HAYSTACK = { x: 14, y: 12, width: 2, height: 2 } as const;

function withinStamp(
  lx: number,
  ly: number,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return lx >= x && ly >= y && lx < x + width && ly < y + height;
}

/**
 * What the village does at a world tile, or `null` where the village has no
 * opinion and the wild terrain stands.
 */
export function villageCellAt(
  x: number,
  y: number,
  site: VillageSite,
): VillageCell | null {
  const lx = x - site.x;
  const ly = y - site.y;
  if (lx < 0 || ly < 0 || lx >= VILLAGE_WIDTH || ly >= VILLAGE_HEIGHT) {
    return null;
  }

  for (const b of BUILDINGS) {
    if (withinStamp(lx, ly, b.x, b.y, HOUSE_WIDTH, HOUSE_HEIGHT))
      return 'solid';
  }
  if (
    withinStamp(lx, ly, HAYSTACK.x, HAYSTACK.y, HAYSTACK.width, HAYSTACK.height)
  ) {
    return 'solid';
  }

  const ground = GROUND[ly][lx];
  if (ground === ' ') return null;
  return ground === ',' ? 'paved' : 'open';
}

/**
 * Which structure's sprite covers a world tile, and which cell of it — what
 * the renderer needs to blit the right piece of the right house.
 */
export interface VillageSprite {
  /** `'house'` indexes {@link BUILDINGS}' `kind`; `'haystack'` has no kind. */
  readonly what: 'house' | 'haystack';
  readonly kind: number;
  readonly dx: number;
  readonly dy: number;
}

export function villageSpriteAt(
  x: number,
  y: number,
  site: VillageSite,
): VillageSprite | null {
  const lx = x - site.x;
  const ly = y - site.y;

  for (const b of BUILDINGS) {
    if (withinStamp(lx, ly, b.x, b.y, HOUSE_WIDTH, HOUSE_HEIGHT)) {
      return { what: 'house', kind: b.kind, dx: lx - b.x, dy: ly - b.y };
    }
  }
  if (
    withinStamp(lx, ly, HAYSTACK.x, HAYSTACK.y, HAYSTACK.width, HAYSTACK.height)
  ) {
    return {
      what: 'haystack',
      kind: 0,
      dx: lx - HAYSTACK.x,
      dy: ly - HAYSTACK.y,
    };
  }

  return null;
}

/** True where a village tile is the cobbled square rather than trodden ground. */
export function isVillageSquare(
  x: number,
  y: number,
  site: VillageSite,
): boolean {
  const lx = x - site.x;
  const ly = y - site.y;
  if (lx < 0 || ly < 0 || lx >= VILLAGE_WIDTH || ly >= VILLAGE_HEIGHT) {
    return false;
  }
  return GROUND[ly][lx] === ',';
}

/** The square's centre, in world tiles — where an NPC or a notice board goes. */
export function villageCentre(site: VillageSite): { x: number; y: number } {
  return {
    x: site.x + Math.floor(VILLAGE_WIDTH / 2),
    y: site.y + Math.floor(VILLAGE_HEIGHT / 2),
  };
}
