**Title**
Equipping or attuning above the ceiling is rejected, naming the ceiling

**Lens**: SW

**Status**: active

**Description**
`equipCard` rejects a card whose rarity exceeds the spirit's ceiling
before it touches the hand-slot budget, and `toggleAttune` rejects the
same card before it touches the attunement budget.
Both reject with a
message stating the spirit's level, the rarity refused, and the ceiling
the spirit currently holds.

Un-attuning is never rejected: the ceiling guard applies only when a card
is being taken on, never when it is being let go.

**Rationale**
Two reducers, one gate — a ceiling enforced only on equip would let a
player attune a card they cannot wield, which would then survive death as
an unusable card and read as a bug rather than a rule.
The message names
the level and the ceiling because the player's fix is "level the spirit,"
and an error that only says "no" does not tell them that.

**Verification Description**
Reviewed at both reducers for the guard placed ahead of the existing
budget checks, and for the un-attune path bypassing it.

## Relations

**Realizes**

- [SYS-010](SYS-010-spirit-level-caps-the-card-rarity-a-player-can-hold-at-all.md)

**Related**

- [SW-025](SW-025-attuning-past-a-rarity-slot-budget-is-rejected-un-attuning-never-is.md) — the attunement budget this guard precedes
- [SW-028](SW-028-equip-card-enforces-level-gate-and-hand-slot-cap-replacing-only-the-exact-slot.md) — the equip gate this guard joins

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
