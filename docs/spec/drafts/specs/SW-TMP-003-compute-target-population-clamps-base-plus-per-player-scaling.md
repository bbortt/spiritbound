**Title**
computeTargetPopulation clamps base-plus-per-player scaling between configured bounds

**Lens**: SW

**Status**: planned

**Description**
`computeTargetPopulation(playersInZone, cfg)` returns
`clamp(cfg.min, cfg.base + playersInZone * cfg.perPlayer, cfg.max)` — the
zone's total enemy population budget scales linearly with player count,
but never falls below `cfg.min` or rises above `cfg.max`.

**Rationale**
A population budget that grows unboundedly with player count would let a
crowded zone spawn without limit; one that shrinks to zero with no
players would leave the map silent.
The clamp keeps both a guaranteed
baseline presence and a hard ceiling regardless of how many players show
up.

**Verification Description**
A unit test asserts: zero players returns `cfg.base` clamped to `cfg.min`
if `base < min`; a player count that would push the raw formula below
`cfg.min` or above `cfg.max` is clamped to the respective bound; a
player count in the unclamped middle of the range returns the raw linear
value exactly.

## Relations

**Realizes**

- [SYS-TMP-002](SYS-TMP-002-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)
