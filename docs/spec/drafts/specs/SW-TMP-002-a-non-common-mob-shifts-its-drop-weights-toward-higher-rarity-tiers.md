**Title**
A non-common mob shifts its drop weights toward higher rarity tiers

**Lens**: SW

**Status**: planned

**Description**
Given a base rarity-weight table and a mob's own rarity, a pure function
in `rules/drops.ts` returns a shifted weight table: for a `common` mob,
the input table is returned unchanged.
For any other mob rarity, the
`common` weight is zeroed and its mass is redistributed across the
remaining four tiers proportional to their existing relative weight — a
tier already at 0 stays at 0 after the shift, since a zero share of any
redistributed mass is still zero.
The output always sums to 1.0.

**Rationale**
"Raises the floor of its drop table" means a non-common mob should be
less likely to drop the most common tier and correspondingly more likely
to drop something better — proportional redistribution achieves that
without inventing new weight for a tier the base table intentionally
excludes (see `CON-004`).
This story applies the same shift regardless of
how far above common the mob's own rarity is (uncommon, rare, epic, and
legendary mobs all get the one shift described here) — a rarity-scaled
shift magnitude (e.g. legendary mobs shifting further than uncommon ones)
is a plausible future refinement but is not what this spec pins.

**Verification Description**
A unit test asserts: a common-rarity mob returns the input table
byte-identical; a non-common mob returns a table with `common: 0` and the
other four weights summing to 1.0 in the same relative proportion as the
input; a table whose `legendary` weight is 0 before the shift still has
`legendary: 0` after, for every non-common mob rarity.

## Relations

**Realizes**

- [SYS-TMP-001](SYS-TMP-001-enemy-difficulty-scales-with-rarity-as-well-as-level.md)

**Related**

- [CON-004](CON-004-legendary-drop-weight-is-zero.md) — unaffected by this shift, see Rationale
- [CON-005](CON-005-empty-rarity-tier-falls-back-to-full-pool-empty-pool-drops-nothing.md) — the fallback that still applies to the shifted table
- [SW-017](SW-017-a-rarity-tier-is-weight-picked-then-sampled-within-tier.md) — the roll this shifted table feeds into
