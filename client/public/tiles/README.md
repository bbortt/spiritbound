# Tilesets

## `mountains-v6.png` — LPC Mountains

Source: <https://opengameart.org/content/lpc-mountains>, downloaded unmodified from the submission's `mountains.zip`.

32 px tiles, 64 x 80 of them.
`client/src/entryZone.ts` indexes into it by `row * 64 + column`.

The entry zone uses the sandstone mesa (columns 1-4, rows 42-43 for the cliff face and its scree fringe; columns 14-18, rows 41-43 for the plateau surface), the flat grass at columns 1-2, rows 72-73, the cobbled trail at columns 24-26, rows 74-76, the grey stone at columns 2-3, rows 53-54, and the boulders at column 12, rows 72-73.

### Licence

CC-BY-SA 3.0 / 4.0 with mandatory attribution.
`CREDITS-mountains.txt` ships next to the image and lists every upstream author; it must stay with the file.

Two caveats before this goes anywhere near a release:

1. The credits list a Mana World tileset under **GPL v2**, which does not combine with this repository's CC-BY-NC-SA-4.0 licence.
   Whether any of that art survives into `mountains-v6.png` — and into the tiles listed above — is unverified.
2. BY-SA forbids adding restrictions, so the image must stay unmodified and separately licensed.
   Editing it would make the result BY-SA rather than NC.

Both are reasons to treat this as proof-of-concept art, not a committed asset choice.
