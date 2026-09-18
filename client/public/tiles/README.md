# Tilesets

Two sheets, both CC0, split by provenance rather than by content: everything Kenney's pack could supply comes from `kenney/roguelike-sheet.png`, and the one thing it could not comes from `cliff-cc0.png`, which is generated.

Carrying two sheets in one map is what Tiled's `firstgid` is for: Kenney's sheet owns gids 1-1767 and the cliff takes over at 1768.

## `kenney/roguelike-sheet.png` — Kenney Roguelike/RPG pack

Source: <https://opengameart.org/content/roguelike-rpg-pack>, downloaded unmodified.
Kenney's own download page for this pack has moved; the OpenGameArt mirror is the same archive by the same author.

16 px tiles, 57 x 31 of them, with a **1 px gutter between tiles and no margin**.
The gutter is the thing to remember: `addTilesetImage` and the `.tmj` tileset both have to be told about it, or every tile draws a pixel off and the error grows as you go right and down.

What the map uses:

- grass at column 5, rows 0-1
- sand, for the plateau, at column 8, rows 0-1
- grey masonry at column 6, rows 2-3
- beige flagstone, for the village square, at column 7, rows 2-3
- the dirt trail as a 3 x 3 edge-matched patch at columns 7-9, rows 9-11
- trees, 1 x 2 each, at columns 13, 15, 16 and 18, rows 10-11
- house roofs, 3 x 3 each, at columns 17, 24 and 31, rows 21-23
- boulders at columns 54-56, rows 21-22, and earth mounds at columns 54-55, rows 19-20

Two notes on picking from this sheet, both learned by rendering it rather than by reading coordinates:

1. Kenney's terrain sets are organic blobs, not a Wang grid.
   One clean 3 x 3 does fall out of the dirt set at columns 7-9, rows 9-11, and the grey set repeats the arrangement at rows 15-17.
2. Most of the building kit is drawn for a three-quarter view — the gabled roof pieces have a transparent notch cut in the bottom for a wall that is supposed to be under them.
   Straight down, a house built from those renders as an arrowhead.
   The flat roof blocks are complete on their own.

### Licence: Kenney Roguelike/RPG pack

CC0 1.0.
No attribution required, no restrictions to propagate, and no conflict with whatever licence the repository settles on.
`kenney/LICENSE-kenney.txt` ships next to the image anyway — Kenney asks for a credit as a courtesy, not as a condition.

## `cliff-cc0.png` — generated

Not downloaded. `tools/mapgen/cliffArt.ts` draws it; run `node tools/mapgen/cliffArt.ts` to regenerate.

16 px tiles, 8 x 3 of them, no gutter and no margin.
Row 0 is the lip where the plateau breaks over, row 1 the face, row 2 the scree fringe at the foot — which is drawn on the overlay layer so the grass shows through its gaps.

**This exists because Kenney's pack has no elevation art of any kind.**
No cliff face, no plateau edge, no mountain; its only vertical surfaces are building walls.
The opening beat in `docs/GAME_DESIGN.md` is "it threw you off a cliff, you wake at the bottom with nothing", so the cliff has to be visible from the spawn point — and it is the one thing a CC0 swap cannot buy off the shelf.

Colours are sampled from Kenney's grey boulders at (54, 21) so the seam between drawn and downloaded stone is not obvious.
It is programmer art and looks it.
It exists to prove the swap renders, not to be the cliff that ships.

### Licence: `cliff-cc0.png`

Original work, so it carries whatever the repository decides — which is also why generating it sidesteps the licence question entirely rather than trading one encumbrance for another.

## Previously here: the LPC sheets

`mountains-v6.png` (LPC Mountains) and `base_out_atlas.png` (LPC Tile Atlas) are the art this pair replaces.
They are still in the tree on the `spike/tiled-chunked-world` branch.

They were dropped for licence reasons, not visual ones — they look better than what replaced them:

1. Their credits include a Mana World tileset under **GPL v2**, and the atlas is CC-BY-SA 3.0 **and** GPL 3.
   Neither combines with this repository's CC-BY-NC-SA-4.0.
   Because both sheets are composites, the CC0 pixels inside them cannot be cherry-picked out.
2. BY-SA forbids adding restrictions, and NonCommercial is one.
   The "ship the PNG unmodified with credits alongside" stance is an aggregation argument, and it collapses the moment anyone edits a pixel of the art.
