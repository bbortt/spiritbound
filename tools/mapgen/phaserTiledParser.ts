// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * The real Phaser Tiled parser, loaded in Node.
 *
 * The point of this file is that the tests do not re-implement Phaser's
 * understanding of a `.tmj` — they run the same `ParseJSONTiled` the browser
 * runs, so "Phaser can read this map" is a fact and not a claim. Phaser's
 * entry point touches `window` at import time, so a handful of DOM globals are
 * stubbed first; the parser itself is pure and never renders anything.
 *
 * Test-only. Nothing that ships imports this.
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const noop = (): void => {};

function stubElement(): Record<string, unknown> {
  return {
    style: {},
    getContext: () => ({
      fillRect: noop,
      drawImage: noop,
      putImageData: noop,
      createImageData: () => ({ data: [] }),
      getImageData: () => ({ data: [0, 0, 0, 0] }),
    }),
    toDataURL: () => 'data:,',
    addEventListener: noop,
    removeEventListener: noop,
    appendChild: noop,
    setAttribute: noop,
    getBoundingClientRect: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    }),
  };
}

/**
 * Node 24 defines `navigator` as a getter-only global, so a plain assignment
 * throws. Everything here is defined rather than assigned for that reason.
 */
function define(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

function installDomStubs(): void {
  const g = globalThis as Record<string, unknown>;
  if (g.window) return;

  define('window', globalThis);
  define('navigator', {
    userAgent: 'node',
    platform: 'node',
    vendor: '',
    appVersion: '',
    maxTouchPoints: 0,
    getGamepads: () => [],
  });
  g.document = {
    createElement: stubElement,
    createElementNS: stubElement,
    documentElement: stubElement(),
    body: stubElement(),
    addEventListener: noop,
    removeEventListener: noop,
    hidden: false,
  };
  g.screen = { width: 1024, height: 768 };
  g.location = { href: 'http://localhost/', protocol: 'http:' };
  g.Image = class {};
  g.HTMLCanvasElement = class {};
  g.HTMLImageElement = class {};
  g.HTMLVideoElement = class {};
  g.requestAnimationFrame = (cb: () => void) => setTimeout(cb, 16);
  g.cancelAnimationFrame = clearTimeout;
}

export interface ParsedTile {
  index: number;
  x: number;
  y: number;
}

export interface ParsedLayer {
  name: string;
  width: number;
  height: number;
  data: (ParsedTile | null)[][];
}

export interface ParsedTileset {
  name: string;
  firstgid: number;
  total: number;
  /**
   * Where Phaser 4 files Tiled's per-tile `properties` — and therefore what
   * `setCollisionByProperty({ collides: true })` reads. Keys are local tile
   * ids as strings. (`tileData` next to it holds animations and collision
   * shapes, and stays empty for this exporter.)
   */
  tileProperties: Record<string, { collides?: boolean } | undefined>;
  tileData: Record<string, unknown>;
}

export interface ParsedObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  rectangle?: boolean;
  properties?: { name: string; type: string; value: number | string }[];
}

export interface ParsedObjectLayer {
  name: string;
  objects: ParsedObject[];
}

export interface ParsedMap {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  infinite: boolean;
  layers: ParsedLayer[];
  tilesets: ParsedTileset[];
  /** One entry per object layer, in file order — not a map keyed by name. */
  objects: ParsedObjectLayer[];
  properties: Record<string, unknown> | unknown[];
}

/** The objects of the named object layer, or `[]` if the map has no such layer. */
export function objectsOf(map: ParsedMap, layer: string): ParsedObject[] {
  return map.objects.find((l) => l.name === layer)?.objects ?? [];
}

/**
 * One custom property of an object. Phaser copies Tiled's `properties` across
 * verbatim — it stays the array of `{ name, type, value }` records Tiled wrote,
 * and is not flattened into an object — so reading one means a lookup.
 */
export function propOf(
  object: ParsedObject,
  name: string,
): number | string | undefined {
  return object.properties?.find((p) => p.name === name)?.value;
}

/**
 * Parse a Tiled JSON map exactly as Phaser would, and fail loudly on the
 * warnings Phaser would otherwise only whisper — an unsupported external
 * tileset or a compressed layer makes Phaser `console.warn` and carry on with
 * a blank map, which is the failure mode this whole exporter is shaped to
 * avoid.
 */
export function parseAsPhaser(json: unknown): ParsedMap {
  installDomStubs();

  // Resolve from the client package, which is where phaser is installed.
  const require = createRequire(
    new URL('../../client/package.json', import.meta.url),
  );
  // Phaser 4's `exports` map only publishes the bundles and `./package.json`,
  // so the parser source is reached through the package root rather than by a
  // subpath specifier — which `exports` would reject.
  const phaserRoot = dirname(require.resolve('phaser/package.json'));
  const parse = require(
    join(
      phaserRoot,
      'src',
      'tilemaps',
      'parsers',
      'tiled',
      'ParseJSONTiled.js',
    ),
  ) as (name: string, source: unknown, insertNull: boolean) => ParsedMap;

  const warnings: string[] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };

  try {
    const mapData = parse('test', json, true);
    if (warnings.length > 0) {
      throw new Error(`Phaser warned while parsing: ${warnings.join(' | ')}`);
    }
    return mapData;
  } finally {
    console.warn = realWarn;
  }
}
