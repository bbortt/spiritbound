// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * The cliff tiles, drawn here rather than downloaded.
 *
 * Kenney's Roguelike/RPG pack has no cliff, no plateau edge and no elevation
 * of any kind — its only vertical surfaces are building walls. Hollow Vale's
 * opening beat needs a cliff you can see from the spawn point, so the one
 * thing the CC0 swap cannot buy is the one thing the scene is built around.
 *
 * So this module generates it: an 8 x 3 strip of 16 px tiles — lip, face,
 * foot — in Kenney's own rock palette, sampled from the grey boulders at
 * sheet (54, 21) so the seam between drawn and downloaded art is not
 * obvious. It is original work, which sidesteps the licence question
 * entirely: it can carry whatever licence the repository settles on.
 *
 * It is also unapologetically programmer art. It exists to prove the swap
 * renders, not to be the cliff that ships.
 *
 * Run `node tools/mapgen/cliffArt.ts` to regenerate
 * `client/public/tiles/cliff-cc0.png`. It is deterministic, so regenerating
 * without changing this file is a no-op in git.
 */

import { blank, encode, type Image } from './png.ts';

export const CLIFF_TILE = 16;
/**
 * Eight variants, not four. The cliff runs the full width of the map, so the
 * strip is cycled sixty times across; at four you can read the repeat from
 * across the screen.
 */
export const CLIFF_COLS = 8;
export const CLIFF_ROWS = 3;

/** Row offsets within the generated strip. */
export const CLIFF_LIP_ROW = 0;
export const CLIFF_FACE_ROW = 1;
export const CLIFF_FOOT_ROW = 2;

/**
 * Sampled from Kenney's grey rock so drawn and downloaded stone agree.
 *
 * Kept as a ramp rather than four loose names: almost everything below works
 * by nudging a pixel one step lighter or darker, and a ramp makes that a `+1`
 * instead of a nest of conditionals.
 */
const ROCK_DEEP = [92, 100, 100];
const ROCK_SHADE = [117, 127, 127];
const ROCK_BASE = [168, 182, 183];
const ROCK_LIGHT = [185, 196, 197];
const RAMP = [ROCK_DEEP, ROCK_SHADE, ROCK_BASE, ROCK_LIGHT];

/** A ramp step, clamped — callers add and subtract freely. */
function tone(i: number): readonly number[] {
  return RAMP[i < 0 ? 0 : i >= RAMP.length ? RAMP.length - 1 : i];
}
/** Kenney's plain sand, the plateau surface this lip belongs to. */
const SAND = [230, 218, 191];
const SAND_SHADE = [217, 202, 169];
/** Kenney's dirt, for the browner rubble at the foot. */
const DIRT = [180, 131, 85];

/** Deterministic per-pixel noise, so regenerating the sheet is a no-op. */
function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x + 0x9e37, 0x1b873593) ^ Math.imul(y + 0x85eb, 0xcc9e2d51);
  h = Math.imul(h ^ salt, 0x27d4eb2d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function put(
  img: Image,
  x: number,
  y: number,
  rgb: readonly number[],
  a = 255,
): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.px[i] = rgb[0];
  img.px[i + 1] = rgb[1];
  img.px[i + 2] = rgb[2];
  img.px[i + 3] = a;
}

/**
 * Smooth value noise: `hash` on a coarse lattice, interpolated between.
 *
 * `cell` is the lattice spacing in pixels, so it sets the size of the features
 * — large for the rock masses, small for the grain over the top of them. It
 * must divide `CLIFF_TILE`, because the lattice wraps every `CLIFF_TILE / cell`
 * rows: a face tile is stacked on itself wherever the drop is more than one
 * tile deep, and noise that does not wrap puts a visible seam at every row
 * boundary.
 */
function noise(x: number, y: number, cell: number, salt: number): number {
  const period = CLIFF_TILE / cell;
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const wrap = (g: number): number => ((g % period) + period) % period;
  const at = (ix: number, iy: number): number => hash(ix, wrap(iy), salt);
  const ease = (t: number): number => t * t * (3 - 2 * t);
  const mix = (a: number, b: number, t: number): number =>
    a + (b - a) * ease(t);
  return mix(
    mix(at(gx, gy), at(gx + 1, gy), fx),
    mix(at(gx, gy + 1), at(gx + 1, gy + 1), fx),
    fy,
  );
}

/**
 * The face: fractured rock masses, lit from the upper left.
 *
 * This is deliberately drawn without a single straight line in it, because
 * every earlier attempt that had one failed the same way. Horizontal bedding
 * planes over vertical striations read as windows, and the cliff came out an
 * office block. Vertical bands alone read as a picket fence. Vertical bands
 * with broken horizontal ledges read as a drystone wall. At 16 px the eye
 * takes any repeated line as something a person built.
 *
 * So: two octaves of value noise pick the tone, and the slope of the coarse
 * one decides which pixels catch the light — blobby masses with shadow
 * between them, no lines anywhere. The noise runs in strip coordinates rather
 * than tile-local ones, so consecutive variants join up instead of showing a
 * seam every 16 px.
 *
 * `yFrom` lets the lip tile start its face partway down.
 */
function drawFace(
  img: Image,
  ox: number,
  oy: number,
  variant: number,
  yFrom: number,
): void {
  const MASS = 0x51;
  for (let x = 0; x < CLIFF_TILE; x++) {
    const wx = variant * CLIFF_TILE + x;
    for (let y = yFrom; y < CLIFF_TILE; y++) {
      const mass = noise(wx, y, 8, MASS);
      let t = mass < 0.3 ? 1 : mass < 0.62 ? 2 : 3;

      // Slope of the mass field. Facing up and left is lit, down and right is
      // in shadow — which is what gives flat noise a third dimension.
      const slope =
        noise(wx + 2, y, 8, MASS) -
        noise(wx - 2, y, 8, MASS) +
        (noise(wx, y + 2, 8, MASS) - noise(wx, y - 2, 8, MASS));
      if (slope < -0.1) t += 1;
      else if (slope > 0.1) t -= 1;

      // Grain, then the cracks where the masses pull apart.
      if (noise(wx, y, 2, 0x52) < 0.18) t -= 1;
      if (mass < 0.1) t = 0;

      put(img, ox + x, oy + y, tone(t));
    }
  }
}

function drawLip(img: Image, ox: number, oy: number, variant: number): void {
  // Where the plateau breaks over, jittered per column. A rim at a constant
  // height across sixty tiles is a ruler line, and the eye reads a ruler line
  // as masonry.
  const FACE_FROM = 10;
  const breakAt = (x: number): number =>
    5 + Math.floor(noise(variant * CLIFF_TILE + x, 0, 4, 0x71) * 4); // 5-8

  for (let x = 0; x < CLIFF_TILE; x++) {
    const rim = breakAt(x);
    for (let y = 0; y < rim; y++) {
      const speck = hash(x, y, variant * 7 + 41) < 0.12;
      put(img, ox + x, oy + y, speck ? SAND_SHADE : SAND);
    }
    put(img, ox + x, oy + rim, ROCK_LIGHT); // the rim catching the sun
    put(img, ox + x, oy + rim + 1, ROCK_DEEP); // and the shadow under it
  }

  // The face starts below the lowest possible rim, so no column is drawn twice.
  drawFace(img, ox, oy, variant, FACE_FROM);
  // Then fill the ragged gap each column leaves between its rim and the face.
  for (let x = 0; x < CLIFF_TILE; x++) {
    for (let y = breakAt(x) + 2; y < FACE_FROM; y++) {
      put(img, ox + x, oy + y, tone(hash(x, y, variant * 7) < 0.4 ? 1 : 2));
    }
  }
}

/**
 * Scree at the foot of the drop, on transparent ground.
 *
 * Drawn on the overlay layer so the grass underneath shows through the gaps;
 * a fully opaque fringe tile would cut a hard band across the vale floor.
 */
function drawFoot(img: Image, ox: number, oy: number, variant: number): void {
  for (let y = 0; y < CLIFF_TILE; y++) {
    for (let x = 0; x < CLIFF_TILE; x++) {
      // Rubble thins out as it spills south, so coverage falls off with y.
      const density = 0.85 - y * 0.075;
      const r = hash(x, y, variant * 53 + 19);
      if (r > density) continue;
      const tone =
        r < density * 0.28
          ? ROCK_LIGHT
          : r < density * 0.6
            ? ROCK_BASE
            : r < density * 0.85
              ? ROCK_SHADE
              : DIRT;
      put(img, ox + x, oy + y, tone);
    }
  }
}

export function buildCliffSheet(): Image {
  const img = blank(
    CLIFF_COLS * CLIFF_TILE,
    CLIFF_ROWS * CLIFF_TILE,
    [0, 0, 0, 0],
  );
  for (let v = 0; v < CLIFF_COLS; v++) {
    const ox = v * CLIFF_TILE;
    drawLip(img, ox, CLIFF_LIP_ROW * CLIFF_TILE, v);
    drawFace(img, ox, CLIFF_FACE_ROW * CLIFF_TILE, v, 0);
    drawFoot(img, ox, CLIFF_FOOT_ROW * CLIFF_TILE, v);
  }
  return img;
}

if (process.argv[1]?.endsWith('cliffArt.ts')) {
  const { writeFileSync } = await import('node:fs');
  const out = 'client/public/tiles/cliff-cc0.png';
  writeFileSync(out, encode(buildCliffSheet()));
  console.log(
    `wrote ${out} (${CLIFF_COLS} x ${CLIFF_ROWS} tiles at ${CLIFF_TILE} px)`,
  );
}
