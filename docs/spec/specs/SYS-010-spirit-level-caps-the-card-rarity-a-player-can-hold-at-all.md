**Title**
Spirit level caps the card rarity a player can hold at all

**Lens**: SYS

**Status**: active

**Description**
A personal spirit has a rarity ceiling derived from its level.
A card
whose rarity exceeds that ceiling cannot be equipped into the hand and
cannot be attuned — the server rejects both, and the client shows the card
as locked rather than offering the action.

The ceiling is about what the spirit can _handle_.
It does not change what
survives death; that remains the attunement-slot budget.

**Rationale**
The original data model named `SpiritDefinition.rarity_ceiling` and the
design says only legendary spirits swap legendary cards, but nothing
enforced it: a fresh character who looted an epic could wield it
immediately, which flattens spirit progression into a slot count.
Gating
rarity makes spirit level the thing that unlocks the card pool, matching
"the spirit is the gate" in `GAME_DESIGN.md`.

**Verification Description**
Unit tests over `computeRarityCeiling`/`canSpiritHandle` in
`spacetimedb/src/rules/death.test.ts`, plus review of the `equipCard` and
`toggleAttune` reducers for the guard.

## Relations

**Related**

- [SYS-007](SYS-007-the-hand-is-a-spirit-level-gated-card-loadout.md) — the hand-slot gate this ceiling sits beside

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
