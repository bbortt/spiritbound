// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * The server's copy of the world.
 *
 * SpacetimeDB is authoritative, so the move reducer cannot ask the client's
 * tilemap whether a position is legal. It gets this instead: one bit per tile,
 * 1 = walkable, packed per chunk so the server can hold the whole world or
 * page it in a chunk at a time.
 *
 * At 64-tile chunks a chunk costs 512 bytes, and a 1024x1024 world costs
 * 128 KB in total — small enough that "load it all at startup" is a real
 * option, which is the point of building the export step now rather than
 * retrofitting one later.
 *
 * This is a derivative of the same `terrainAt` field the tilemap is drawn
 * from, never a hand-maintained second copy; `walkability.test.ts` asserts the
 * two agree tile for tile.
 */

import { chunkCountX, chunkCountY } from './chunk.ts';
import { isSolid, terrainAt, type WorldSpec } from './terrain.ts';

const MAGIC = 'SBWALK\0';
const VERSION = 1;
const HEADER_BYTES = 8 + 16;

export function chunkBitmaskBytes(chunkSize: number): number {
  return Math.ceil((chunkSize * chunkSize) / 8);
}

/** Pack one chunk: bit i (LSB-first) is tile (i % size, i / size), 1 = walkable. */
export function encodeChunkWalkability(
  cx: number,
  cy: number,
  spec: WorldSpec,
): Uint8Array {
  const size = spec.chunkSize;
  const out = new Uint8Array(chunkBitmaskBytes(size));

  for (let ly = 0; ly < size; ly++) {
    for (let lx = 0; lx < size; lx++) {
      const x = cx * size + lx;
      const y = cy * size + ly;
      if (isSolid(terrainAt(x, y, spec))) continue;
      const i = ly * size + lx;
      out[i >> 3] |= 1 << (i & 7);
    }
  }

  return out;
}

/** The whole world: header plus every chunk's bitmask, in row-major order. */
export function encodeWorldWalkability(spec: WorldSpec): Uint8Array {
  const nx = chunkCountX(spec);
  const ny = chunkCountY(spec);
  const stride = chunkBitmaskBytes(spec.chunkSize);
  const out = new Uint8Array(HEADER_BYTES + nx * ny * stride);
  const view = new DataView(out.buffer);

  for (let i = 0; i < MAGIC.length; i++) out[i] = MAGIC.charCodeAt(i);
  out[7] = VERSION;
  view.setUint32(8, spec.width, true);
  view.setUint32(12, spec.height, true);
  view.setUint32(16, spec.chunkSize, true);
  view.setUint32(20, spec.seed, true);

  for (let cy = 0; cy < ny; cy++) {
    for (let cx = 0; cx < nx; cx++) {
      const chunk = encodeChunkWalkability(cx, cy, spec);
      out.set(chunk, HEADER_BYTES + (cy * nx + cx) * stride);
    }
  }

  return out;
}

export interface WalkabilityGrid {
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly seed: number;
  /** Tile coordinates outside the world read as not walkable. */
  isWalkable(x: number, y: number): boolean;
}

/** The read side — this is what the SpacetimeDB module would call. */
export function decodeWorldWalkability(bytes: Uint8Array): WalkabilityGrid {
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) {
      throw new Error('not a walkability blob');
    }
  }
  if (bytes[7] !== VERSION) {
    throw new Error(`unsupported walkability version ${bytes[7]}`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(8, true);
  const height = view.getUint32(12, true);
  const chunkSize = view.getUint32(16, true);
  const seed = view.getUint32(20, true);

  const nx = Math.ceil(width / chunkSize);
  const stride = chunkBitmaskBytes(chunkSize);

  return {
    width,
    height,
    chunkSize,
    seed,
    isWalkable(x: number, y: number): boolean {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      const cx = Math.floor(x / chunkSize);
      const cy = Math.floor(y / chunkSize);
      const i = (y % chunkSize) * chunkSize + (x % chunkSize);
      const base = HEADER_BYTES + (cy * nx + cx) * stride;
      return (bytes[base + (i >> 3)] & (1 << (i & 7))) !== 0;
    },
  };
}
