**Title**
The verse lives in the document and the manifest is tested against it

**Lens**: ARCH

**Status**: active

**Description**
`docs/PROLOGUE.md` is the single source of truth for the text of the
poem.
`client/src/prologueBeats.ts` carries a flat manifest of beats —
plate id, shot size, the lines to show, hold duration, parallax factors
— and a unit test asserts that every line of verse in that manifest
occurs verbatim in `docs/PROLOGUE.md`.

The manifest is **not** parsed from the markdown at build or run time,
and the markdown is **not** generated from the manifest.
They are two
files kept honest by a test.

**Rationale**
Only one of these two files is edited by a person writing poetry, and it
is the markdown.
Shipping the verse only in TypeScript would make every
revision a code change and guarantee the document goes stale; shipping
it only in markdown would mean parsing prose at runtime to find out how
long to hold a shot.

Parsing the document was the obvious third option and is rejected: the
poem's structure is carried by blank lines, block quotes and em-dashed
headings that exist for a human reader, and a parser over that is a
thing that breaks when someone adds a stanza note.
The timing, parallax
and plate data have no home in the markdown anyway, so a parser would
only ever supply half the manifest.

A substring assertion is deliberately weaker than a round-trip: it
catches the failure that actually happens — a line revised in the poem
and not in the code — without forcing the manifest to carry every
editorial comment in the document.

**Verification Description**
A **unit** test (`client/src/prologueBeats.test.ts`) reads
`docs/PROLOGUE.md` from disk and asserts that each line in each beat's
`lines` array appears in it.
The test must also assert the document was
actually read and is non-empty, so a moved or renamed file fails loudly
instead of vacuously passing against an empty haystack.

## Relations

**Related**

- [STR-015](../stories/STR-015-the-prologue-plays-once-per-account-before-the-first-life.md) — the story delivering this decision
- [ARCH-011](ARCH-011-the-client-duplicates-compute-xp-reward-to-render-the-floating-number.md) — the existing precedent for deliberate duplication in the client, held true by a test rather than by a shared module
