**Title**
Rarity multipliers cover every rarity at or above one, increasing by tier

**Lens**: CON

**Status**: planned

**Description**
`content/config.json`'s `enemies.rarityMultipliers` must define an
`{hp, damage}` pair for all five rarities, each value `>= 1.0`, and both
`hp` and `damage` strictly increasing from `common` through `legendary`.
A config violating either bound is rejected at validation.

**Rationale**
A multiplier below 1.0 would make a higher-rarity enemy weaker than a
common one, contradicting the entire point of the rarity axis; a
non-increasing step (e.g. `rare` no stronger than `uncommon`) would make
two rarities indistinguishable in practice.
This mirrors the existing
guard-rail precedent for other operator-editable balance tables
(`SW-031`'s rarity-weight-sums-to-one, `SW-032`'s ordered XP band).
Note
for implementation: `rarityMultipliers` is a distinct schema shape from
`content/validateConfig.ts`'s existing `RarityWeightsSchema` (which is
five `0..1` chances summing to 1.0) — it must not be reused as-is, since
this table holds `{hp, damage}` multiplier pairs with no sum constraint.

**Verification Description**
`content/config.test.ts` asserts the shipped multiplier table (common
1.0/1.0 through legendary 40.0/3.2) validates, and that a mutation making
any multiplier `< 1.0`, or making a later tier's multiplier `<=` an
earlier tier's, is rejected.

## Relations

**Realizes**

- [SYS-TMP-001](SYS-TMP-001-enemy-difficulty-scales-with-rarity-as-well-as-level.md)
