**Title**
The rarity ceiling steps at spirit levels 5, 12, 25 and 40

**Lens**: SW

**Status**: active

**Description**
`computeRarityCeiling(spiritLevel)` returns `common` below level 5,
`uncommon` from 5, `rare` from 12, `epic` from 25, and `legendary` from 40.
`canSpiritHandle(spiritLevel, cardRarity)` is true exactly when the
card's rarity is at or below that ceiling in the canonical rarity order.

**Rationale**
The thresholds sit deliberately below the attunement-slot thresholds for
the same tiers — a spirit reaches `rare` at level 12 but only earns its
first rare attunement slot around level 10 and its legendary slot at 30,
against a legendary ceiling at 40.
That ordering is the point: a player
gets to _wield_ a tier for a stretch of levels before they can _protect_
it, so the card is a risk before it is an asset.

**Verification Description**
`spacetimedb/src/rules/death.test.ts` asserts the ceiling at each boundary
level and one below it, and that `canSpiritHandle` accepts at the ceiling
and rejects one tier above.

## Relations

**Realizes**

- [SYS-010](SYS-010-spirit-level-caps-the-card-rarity-a-player-can-hold-at-all.md)

**Related**

- [SW-023](SW-023-attunement-slots-per-rarity-grow-with-spirit-level-legendary-gated-at-thirty.md) — the death-side budget these thresholds are tuned against

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
