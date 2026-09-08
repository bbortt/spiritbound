**Title**
Seeding upserts content by slug — re-running the seeder is always safe

**Lens**: SW

**Status**: active

**Description**
`seedCards`/`seedItems`/`seedZones` look up each JSON entry's existing
database row by that entry's stable identity key
(`ctx.db.cardDefinition.slug.find(...)` and the `itemDefinition`
equivalent; the authored key of a `zone` entry for `seedZones`) to decide
insert vs. update, rather than blindly inserting — re-running any seeder
(e.g. on every publish) is always idempotent, never appends duplicate rows
for content that already exists.

**Rationale**
Content authors and CI need to be able to re-seed freely (e.g. after any
content or balance-number edit) without needing a separate migration step
or risking duplicate definitions accumulating over repeated publishes.

**Verification Description**
A test seeds the same content twice and asserts the definition table
still has exactly one row per slug, with the second pass's field values
winning if changed.
No existing test in `content/cards.test.ts`/
`content/equipment.test.ts` currently covers the seed/upsert step itself
(both files only exercise validation) — this is a coverage gap the
anchoring pass must close.

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)

**Related**

- [STR-010](../stories/STR-010-zone-content-pipeline.md) — the story extending this behaviour to `seedZones`

## Changes

- **2026-09-08** — Widened to cover `seedZones`, on promotion of STR-010,
  and generalised "by its `slug`" to "by that entry's stable identity key".
  The idempotence this spec pins is unchanged and is what matters; the
  wording no longer asserts `slug` specifically for every content kind,
  because the `zone` table has no `slug` column today (its primary key is
  `zoneId`, which `content/zones.json` authors explicitly) while
  `cardDefinition`/`itemDefinition` do.
  Which key `seedZones` upserts on —
  and therefore whether the `zone` table gains a `slug` column at all — is
  STR-010's to settle when it is implemented; this spec deliberately does
  not pre-empt it, since either choice satisfies the idempotence guarantee.
