**Title**
A rarity tier is chosen by cumulative weight, then a definition is sampled uniformly within that tier

**Lens**: SW

**Status**: active

**Description**
Given an eligible pool, a rarity tier is picked first by cumulative weight
(common 60% / uncommon 25% / rare 12% / epic 3% / legendary 0%, rolled
against a single `randomRoll`), then one definition is uniformly sampled
from the eligible definitions matching that tier (via a second random
index roll) — never a flat uniform pick across all eligible definitions
regardless of rarity.

**Rationale**
This is what makes "common-heavy but not common-only" drops possible
without needing a separate weight per individual item — the weight lives
once, at the rarity level, and every item within a tier is equally likely.

**Verification Description**
A unit test asserts the cumulative-weight boundaries are respected (a roll
just below, at, and just above each cumulative threshold selects the
expected tier) and that legendary (weight 0) is never selected regardless
of `randomRoll` value.

## Relations

**Realizes**

- [SYS-004](SYS-004-enemy-deaths-roll-level-gated-rarity-weighted-ground-drops.md)

**Related**

- [CON-004](CON-004-legendary-drop-weight-is-zero.md)
- [CON-005](CON-005-empty-rarity-tier-falls-back-to-full-pool-empty-pool-drops-nothing.md)
