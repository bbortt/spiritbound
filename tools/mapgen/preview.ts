// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Renders generated map data to a PNG, so a tileset change can be looked at
 * instead of reasoned about.
 *
 * The client is the real renderer; this is deliberately not it. It draws the
 * same three layers Phaser draws, in the same order, from the same chunk data
 * and the same palette — which is enough to answer "does the art read?"
 * without a browser, a GPU or a running SpacetimeDB. On a Raspberry Pi with
 * no Chromium that is the difference between seeing the map and not.
 *
 * What it does not do: entities, lighting, depth sorting against the player,
 * or the camera. A tile that looks right here can still look wrong in motion.
 *
 *   node tools/mapgen/preview.ts entry [scale]  → the entry zone, whole
 *   node tools/mapgen/preview.ts vale  [scale]  → Hollow Vale at the village
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { buildChunk } from './chunk.ts';
import { SHEETS, SRC_TILE, sheetForGid, tilePixel } from './palette.ts';
import { blank, blit, decode, encode, type Image } from './png.ts';
import { type WorldSpec } from './terrain.ts';
import { villageCentre } from './village.ts';
import { HOLLOW_VALE, settle } from './world.ts';

const TILES_DIR = 'client/public/tiles';

/** Sheet images, loaded once and indexed by sheet id. */
function loadSheets(): Map<string, Image> {
  const out = new Map<string, Image>();
  for (const sheet of SHEETS) {
    out.set(sheet.id, decode(readFileSync(`${TILES_DIR}/${sheet.image}`)));
  }
  return out;
}

/** Draw one gid at a tile position. gid 0 means "nothing here". */
function drawGid(
  dst: Image,
  sheets: Map<string, Image>,
  g: number,
  tx: number,
  ty: number,
  scale: number,
): void {
  if (g <= 0) return;
  const sheet = sheetForGid(g);
  if (!sheet) return;
  const local = g - sheet.firstGid;
  const src = sheets.get(sheet.id);
  if (!src) return;
  const { x, y } = tilePixel(
    sheet,
    local % sheet.columns,
    Math.floor(local / sheet.columns),
  );
  blit(
    dst,
    src,
    x,
    y,
    SRC_TILE,
    SRC_TILE,
    tx * SRC_TILE * scale,
    ty * SRC_TILE * scale,
    scale,
  );
}

export interface GridLayers {
  readonly width: number;
  readonly height: number;
  /** Row-major gids, one entry per tile, drawn back to front. */
  readonly layers: readonly (readonly number[])[];
}

/** Composite a stack of gid layers into an image at `scale`x. */
export function renderLayers(
  grid: GridLayers,
  sheets: Map<string, Image>,
  scale: number,
): Image {
  const img = blank(
    grid.width * SRC_TILE * scale,
    grid.height * SRC_TILE * scale,
    // Tiled's own background colour, so gaps in the art are obvious rather
    // than quietly reading as "some dark terrain".
    [16, 20, 24, 255],
  );
  for (const layer of grid.layers) {
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        drawGid(img, sheets, layer[y * grid.width + x], x, y, scale);
      }
    }
  }
  return img;
}

/** A rectangle of world tiles, pulled from however many chunks it spans. */
function worldSlice(
  spec: WorldSpec,
  x0: number,
  y0: number,
  w: number,
  h: number,
): GridLayers {
  const ground = new Array<number>(w * h).fill(0);
  const overlay = new Array<number>(w * h).fill(0);
  const above = new Array<number>(w * h).fill(0);
  const cache = new Map<string, ReturnType<typeof buildChunk>>();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wx = x0 + x;
      const wy = y0 + y;
      const cx = Math.floor(wx / spec.chunkSize);
      const cy = Math.floor(wy / spec.chunkSize);
      const key = `${cx},${cy}`;
      let chunk = cache.get(key);
      if (!chunk) {
        chunk = buildChunk(cx, cy, spec);
        cache.set(key, chunk);
      }
      const lx = wx - chunk.originX;
      const ly = wy - chunk.originY;
      const at = ly * chunk.size + lx;
      ground[y * w + x] = chunk.ground[at];
      overlay[y * w + x] = chunk.overlay[at];
      above[y * w + x] = chunk.above[at];
    }
  }
  return { width: w, height: h, layers: [ground, overlay, above] };
}

async function main(): Promise<void> {
  const what = process.argv[2] ?? 'vale';
  const scale = Number(process.argv[3] ?? 3);
  const sheets = loadSheets();

  if (what === 'entry') {
    const { buildEntryZone, MAP_W, MAP_H } =
      await import('../../client/src/entryZone.ts');
    const zone = buildEntryZone();
    const flat = (rows: number[][]): number[] => rows.flat();
    const img = renderLayers(
      {
        width: MAP_W,
        height: MAP_H,
        layers: [
          flat(zone.ground),
          flat(zone.overlay).map((g) => (g < 0 ? 0 : g)),
        ],
      },
      sheets,
      scale,
    );
    writeFileSync('docs/preview-entry-zone.png', encode(img));
    console.log(`docs/preview-entry-zone.png ${img.width}x${img.height}`);
    return;
  }

  const spec = settle(HOLLOW_VALE);
  // A 96-tile window on the village, which is the busiest thing the generator
  // makes and therefore the most informative to look at. `findVillageSite`
  // puts it near the world's centre but not at it, so centring on the world
  // instead is a good way to render 96 tiles of empty field.
  const size = 96;
  const centre = spec.village
    ? villageCentre(spec.village)
    : { x: Math.floor(spec.width / 2), y: Math.floor(spec.height / 2) };
  const x0 = Math.max(0, centre.x - size / 2);
  const y0 = Math.max(0, centre.y - size / 2);
  const img = renderLayers(worldSlice(spec, x0, y0, size, size), sheets, scale);
  writeFileSync('docs/preview-hollow-vale.png', encode(img));
  console.log(`docs/preview-hollow-vale.png ${img.width}x${img.height}`);
}

if (process.argv[1]?.endsWith('preview.ts')) await main();
