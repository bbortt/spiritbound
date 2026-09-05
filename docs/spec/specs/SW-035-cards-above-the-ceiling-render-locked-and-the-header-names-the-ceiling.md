**Title**
Cards above the ceiling render locked and the header names the ceiling

**Lens**: SW

**Status**: active

**Description**
In both the collection and the spirit panel, a card whose rarity exceeds
the spirit's ceiling is dimmed, carries a lock marker, and offers neither
the equip nor the attune action.
Its tooltip states the card's rarity, the
spirit's current level, and the ceiling that level grants.
The spirit
panel's header reads the ceiling in words, e.g. `Spirit Lv 8 — can handle
up to Uncommon cards`.

**Rationale**
The server already rejects the action; the client's job is to stop the
player discovering that by failing.
Naming the ceiling in the header — not
only on the blocked card — makes the rule legible before a player owns a
card that trips it, which is what turns the ceiling into a progression
goal rather than a surprise.

**Verification Description**
Manual/browser QA per the UI testing rule in `005-testing-contract.md`:
with a level-1 spirit, rare and above render locked with the tooltip, and
the spirit panel header names `Common`.
The pure ceiling calculation the
panel reads is unit-tested in `client/src/handSlots.test.ts`.

## Relations

**Realizes**

- [SYS-010](SYS-010-spirit-level-caps-the-card-rarity-a-player-can-hold-at-all.md)

**Related**

- [ARCH-008](ARCH-008-collection-panels-client-duplicate-is-corrected-to-match-rules-death-exactly.md) — the client duplicate this calculation joins

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
