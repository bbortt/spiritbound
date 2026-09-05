**Title**
Content is authored as JSON, validated, then idempotently seeded

**Lens**: SYS

**Status**: active

**Description**
Card and item content is authored as JSON files, checked by a Zod schema
plus cross-field balance rules before anything else touches it, and
upserted into the live database keyed by slug — a card or item can never
be hand-edited directly into the database, only through the
file → validator → seeder path.

**Rationale**
`content/cards.json`/`content/equipment.json` are the single source of
truth for all game content (`docs/ARCHITECTURE.md`'s "Content pipeline"
ADR) — validation at the file boundary is what lets `ability-balancer`/
`item-balancer` edit content safely without the live database and the
authored file ever silently diverging.

**Verification Description**
Reviewed via the SW/CON specs this realizes, each independently
verifiable by test or manual QA.

## Relations

**Related**

- [STR-008](../stories/STR-008-content-validation.md) — the story delivering this capability
