// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * World exporter.
 *
 *     node tools/mapgen/index.ts [--out <dir>] [--width N] [--height N]
 *
 * Writes, under `<out>/hollow-vale/`:
 *   manifest.json        what the client needs to start streaming
 *   chunks/<cy>/<cx>.tmj one Tiled map per chunk
 *   walkability.bin      the server's authoritative bit grid
 *
 * Run with plain `node` — Node 24 strips the types.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chunkToTmj } from './tmj.ts';
import { encodeWorldWalkability } from './walkability.ts';
import {
  buildChunk,
  buildManifest,
  chunkCountX,
  chunkCountY,
  chunkObjects,
  crossingSeconds,
  HOLLOW_VALE,
  settle,
} from './world.ts';
import { type WorldSpec } from './terrain.ts';

const ZONE_ID = 1;
const ZONE_SLUG = 'hollow-vale';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_OUT = join(REPO_ROOT, 'client', 'public', 'maps');

export interface ExportReport {
  chunks: number;
  tmjBytes: number;
  walkabilityBytes: number;
  largestChunkBytes: number;
}

export function exportWorld(spec: WorldSpec, outDir: string): ExportReport {
  const root = join(outDir, ZONE_SLUG);
  const manifest = buildManifest(spec, ZONE_ID, ZONE_SLUG);
  const spawn = { x: manifest.spawn.tileX, y: manifest.spawn.tileY };

  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const nx = chunkCountX(spec);
  const ny = chunkCountY(spec);
  let tmjBytes = 0;
  let largestChunkBytes = 0;

  for (let cy = 0; cy < ny; cy++) {
    const dir = join(root, 'chunks', String(cy));
    mkdirSync(dir, { recursive: true });

    for (let cx = 0; cx < nx; cx++) {
      const chunk = buildChunk(cx, cy, spec);
      const objects = chunkObjects(cx, cy, spec, spawn, ZONE_ID, ZONE_SLUG);
      const json = JSON.stringify(chunkToTmj(chunk, spec, objects));
      writeFileSync(join(dir, `${cx}.tmj`), json);
      tmjBytes += Buffer.byteLength(json);
      largestChunkBytes = Math.max(largestChunkBytes, Buffer.byteLength(json));
    }
  }

  const walk = encodeWorldWalkability(spec);
  writeFileSync(join(root, 'walkability.bin'), walk);

  return {
    chunks: nx * ny,
    tmjBytes,
    walkabilityBytes: walk.byteLength,
    largestChunkBytes,
  };
}

function numArg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
}

function main(): void {
  const outIdx = process.argv.indexOf('--out');
  const outDir =
    outIdx === -1 ? DEFAULT_OUT : resolve(process.argv[outIdx + 1]);

  // Site the village before anything is drawn: `terrainAt` needs it in hand to
  // answer for the tiles the village covers.
  const spec: WorldSpec = settle({
    ...HOLLOW_VALE,
    width: numArg('width', HOLLOW_VALE.width),
    height: numArg('height', HOLLOW_VALE.height),
  });

  const started = Date.now();
  const report = exportWorld(spec, outDir);
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

  process.stdout.write(
    [
      `world      ${spec.width}x${spec.height} tiles, seed 0x${spec.seed.toString(16)}`,
      `crossing   ${(crossingSeconds(spec) / 60).toFixed(1)} min at 180 px/s`,
      `village    ${spec.village ? `Millbrook at ${spec.village.x},${spec.village.y}` : 'none'}`,
      `chunks     ${report.chunks} files, ${mb(report.tmjBytes)} total, ${kb(report.largestChunkBytes)} largest`,
      `walkable   ${kb(report.walkabilityBytes)} (whole world, server side)`,
      `resident   ~${kb(report.largestChunkBytes * 9)} for a 3x3 chunk window`,
      `elapsed    ${((Date.now() - started) / 1000).toFixed(1)}s`,
      `out        ${join(outDir, ZONE_SLUG)}`,
      '',
    ].join('\n'),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
