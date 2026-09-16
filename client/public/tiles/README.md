# Tilesets

## `mountains-v6.png` — LPC Mountains

Source: <https://opengameart.org/content/lpc-mountains>, downloaded unmodified from the submission's `mountains.zip`.

32 px tiles, 64 x 80 of them.
`client/src/entryZone.ts` indexes into it by `row * 64 + column`.

The entry zone uses the sandstone mesa (columns 1-4, rows 42-43 for the cliff face and its scree fringe; columns 14-18, rows 41-43 for the plateau surface), the flat grass at columns 1-2, rows 72-73, the cobbled trail at columns 24-26, rows 74-76, the grey stone at columns 2-3, rows 53-54, and the boulders at column 12, rows 72-73.

### Licence: LPC Mountains

CC-BY-SA 3.0 / 4.0 with mandatory attribution.
`CREDITS-mountains.txt` ships next to the image and lists every upstream author; it must stay with the file.

Two caveats before this goes anywhere near a release:

1. The credits list a Mana World tileset under **GPL v2**, which does not combine with this repository's CC-BY-NC-SA-4.0 licence.
   Whether any of that art survives into `mountains-v6.png` — and into the tiles listed above — is unverified.
2. BY-SA forbids adding restrictions, so the image must stay unmodified and separately licensed.
   Editing it would make the result BY-SA rather than NC.

Both are reasons to treat this as proof-of-concept art, not a committed asset choice.

## `base_out_atlas.png` — LPC Tile Atlas (outdoor base)

Source: <https://opengameart.org/content/lpc-tile-atlas>, downloaded unmodified.

32 px tiles, 32 x 32 of them.
`tools/mapgen/palette.ts` indexes into it by `row * 32 + column`.

It is here because the mountains sheet has no trees and no buildings, and this one has both, in the same LPC style at the same tile size.
The map generator uses the broadleaf and pine trees at columns 24-29, rows 12-17, the house roofs and walls at columns 0-7, rows 9-15, the grey stone walls at columns 3-5, rows 12-13, and the haystack at columns 11-12, rows 21-22.

Carrying two sheets in one map is what Tiled's `firstgid` is for: the mountains sheet owns gids 1-5120 and this one takes over at 5121.

### Licence: LPC Tile Atlas

CC-BY-SA 3.0 **and** GPL 3, per the submission page — the same two problems as the mountains sheet, one of them worse.

1. GPL 3 does not combine with this repository's CC-BY-NC-SA-4.0 licence, any more than the mountains sheet's GPL v2 does.
2. BY-SA forbids adding restrictions, so the image must stay unmodified and separately licensed.

This is spike art.
Shipping it means either relicensing the project or swapping in something CC0, and the second is the cheaper answer: `tools/mapgen/palette.ts` is the only file that would have to change.
