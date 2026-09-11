**Title**
Content is authored as JSON, validated, then idempotently seeded

**Lens**: SYS

**Status**: active

**Description**
Card, item, and zone content is authored as JSON files, checked by a Zod
schema plus cross-field balance rules before anything else touches it, and
upserted into the live database keyed by slug — a card, item, or zone can
never be hand-edited directly into the database, only through the
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
- [STR-010](../stories/STR-010-zone-content-pipeline.md) — the story extending this capability to zone content

## Changes

- **2026-09-08** — Widened from "card and item content" to also name zone
  content, on promotion of STR-010.
  The pipeline itself is unchanged — zone
  content follows the identical file → validator → seeder path through
  `content/zones.json`, its validator, and `seedZones` — but the description
  named only the two content kinds that existed when it was written, so the
  seven zone-validation constraints STR-010 realizes (`CON-019` … `CON-025`)
  would otherwise realize a capability whose text excluded them.
  No change
  of intent.
