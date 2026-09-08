**Title**
planAdjustments caps total spawns and despawns per tick and favours spawning when both are pending

**Lens**: SW

**Status**: planned

**Description**
Across all bands in one call, `planAdjustments` caps the total spawn
count at `cfg.maxSpawnsPerTick` and the total despawn count at
`cfg.maxDespawnsPerTick` — both are zone-wide totals for the tick, not
per-band limits.
When both spawns and despawns are pending in the same
tick, spawns are computed and returned in full (up to their own cap)
before despawns are considered, so a tick that would otherwise do both is
never resolved by cutting spawns to make room for despawns.

**Rationale**
An unbounded director could spawn or despawn dozens of enemies in one
tick, which reads to a nearby player as mobs popping in or vanishing
around them.
Favouring spawns over despawns when both are pending is a
deliberate asymmetry: being slightly over-populated for one more tick is
harmless, while an aggressive despawn pass risks removing an enemy a
player is about to notice.

**Verification Description**
A unit test with demand exceeding `maxSpawnsPerTick` across multiple
bands asserts the total spawn count returned never exceeds the cap
(similarly for despawns), and a unit test with both spawn- and
despawn-eligible bands present in the same call asserts the full eligible
spawn count (up to its cap) is returned unreduced regardless of pending
despawns.

## Relations

**Realizes**

- [SYS-013](SYS-013-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)
