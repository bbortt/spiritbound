# mapgen

Generates Hollow Vale: a 1024 x 1024 tile world, exported as Tiled maps for the client and a bit grid for the server.

```sh
node tools/mapgen/index.ts                       # 1024x1024 into client/public/maps
node tools/mapgen/index.ts --width 256 --height 256
node tools/mapgen/index.ts --out /tmp/world
```

Plain `node` — Node 24 strips the types.
Output is gitignored; the generator is the source, and a full export takes about four seconds.

## Looking at it

```sh
node tools/mapgen/preview.ts vale  3   # docs/preview-hollow-vale.png
node tools/mapgen/preview.ts entry 3   # docs/preview-entry-zone.png
node tools/mapgen/cliffArt.ts          # regenerate client/public/tiles/cliff-cc0.png
```

`preview.ts` renders the same layers Phaser renders, in the same order, from the same chunk data and palette, straight to a PNG.
It is not the renderer and does not draw entities, lighting or the camera — but it answers "does the art read?" without a browser or a GPU, which on a Raspberry Pi is the difference between seeing the map and not.

## What comes out

```text
client/public/maps/hollow-vale/
  manifest.json          world size, chunk size, tilesets, spawn, village
  chunks/<cy>/<cx>.tmj   one finite Tiled map per 64x64 chunk
  walkability.bin        one bit per tile, packed, 128 KB for the whole world
```

Chunks are finite rather than one Tiled "infinite" map because Phaser allocates a `Tile` object per cell at parse time.
A 1024 x 1024 map is a million of them before the player has moved.

## The invariant

`terrainAt(x, y, spec)` is a pure function of the coordinate and the seed.
It never scans, never caches, and never looks further than two rows away.
That is what lets chunk (7, 12) be built, thrown away, and rebuilt without chunk (6, 12) ever existing — which is the whole point of the exercise, and the thing to preserve when adding to `terrain.ts`.

The one exception proves it.
A village is a composition, not a field: the roof has to sit on the walls and the door has to face the square.
So `world.ts` sites it once by scanning the wild terrain, then stores the result in `WorldSpec.village`.
By the time any tile is drawn the site is a constant, and `villageCellAt` is back to being O(1).

## The files

- `terrain.ts` — the noise fields, and the terrain vocabulary they produce; knows nothing about art.
- `village.ts` — Millbrook's hand-authored layout, in village-local coordinates.
- `palette.ts` — terrain and structures to tileset gids; where an art swap mostly lands.
- `cliffArt.ts` — the cliff tiles, generated rather than downloaded; see the note below.
- `png.ts` — a small PNG codec, so the above needs no native image dependency.
- `preview.ts` — renders map data to a PNG for looking at; not the renderer.
- `chunk.ts` — one chunk's three tile layers, assembled from the above.
- `tmj.ts` — chunk to Tiled JSON, base64-uncompressed so Phaser can read it.
- `walkability.ts` — the server's copy of collision, packed; the client's tilemap is presentation only.
- `world.ts` — world spec, village siting, object layers, manifest.
- `phaserTiledParser.ts` — test-side helpers that run Phaser's real parser over the output.

## Tests

```sh
npx vitest run tools/mapgen
npx tsc -p tools/tsconfig.json
```

`tmj.test.ts` parses exported chunks through Phaser's own `ParseJSONTiled`, so "it loads" is checked against the engine rather than against a guess about the format.

## What an art swap actually costs

`palette.ts` was described here as the only file that changes when the art is swapped.
Swapping the LPC sheets for Kenney's CC0 pack proved that wrong, and it is worth writing down what else moved:

- `tmj.ts` hardcoded `margin: 0, spacing: 0` and `imagewidth: 0`.
  Kenney ships a 1 px gutter, so those became real values off the `Sheet`.
- `client/src/entryZone.ts` keeps its own copy of the tile indices, because `client/tsconfig.json` includes only `src` and the client imports nothing from `tools/`.
  Both copies have to be changed together.
- `client/src/scenes/GameScene.ts` loaded one texture at a fixed 32 px and called the four-argument `addTilesetImage`.
  Two sheets with a gutter need the seven-argument form, and a grid of global ids rather than plain indices.

So: `palette.ts` is where the _picks_ live, but the tile size, the gutter and the number of sheets are structural and leak into three other files.
