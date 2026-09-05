**Title**
Seeding upserts content by slug — re-running the seeder is always safe

**Lens**: SW

**Status**: active

**Description**
`seedCards`/`seedItems` look up each JSON entry's existing database row by
its `slug` (`ctx.db.cardDefinition.slug.find(...)` / the equivalent for
`itemDefinition`) to decide insert vs. update, rather than blindly
inserting — re-running the seeder (e.g. on every publish) is always
idempotent, never appends duplicate rows for content that already exists.

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
