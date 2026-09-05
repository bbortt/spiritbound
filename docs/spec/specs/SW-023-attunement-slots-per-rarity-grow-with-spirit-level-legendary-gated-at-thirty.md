**Title**
Attunement slots grow per rarity with spirit level; legendary is gated at level 30, capped at 1

**Lens**: SW

**Status**: active

**Description**
`computeAttunementSlots(spiritLevel)` returns independent, capped
per-rarity slot counts: common `min(8, floor(level*0.6)+1)`, uncommon
`min(6, floor(level*0.4))`, rare `min(4, floor(level*0.2))`, epic
`min(2, floor(level*0.08))`, legendary exactly 1 if `level >= 30` else 0
(never more than 1, ever, regardless of level beyond 30).

**Rationale**
Explicit design rule, stated in `rules/death.ts`'s own comment: "you
cannot hoard 10 legendaries through death." The legendary gate is a hard
level threshold, not a gradual scale like the other rarities, forcing a
real choice about which single legendary is worth protecting.

**Verification Description**
A unit test sweeps `spiritLevel` from 1 to 50+ and asserts each rarity's
cap is respected, the caps stop growing at the stated max values, and
legendary is exactly 0 below level 30 and exactly 1 at and above it (never
scaling further with level).

## Relations

**Realizes**

- [SYS-006](SYS-006-death-destroys-gear-and-un-attuned-cards-keeps-only-what-was-attuned.md)

**Related**

- [SW-022](SW-022-only-attuned-cards-survive-consuming-a-rarity-slot-each.md)
