**Title**
A spawn point must clear the minimum player distance, or the spawn is skipped

**Lens**: CON

**Status**: planned

**Description**
A spawn only executes at a point at least `minSpawnDistFromPlayerPx` from
every alive player in the zone.
If no such point can be found, that
spawn action is skipped entirely for the tick — it is never placed at the
nearest available point, and never forced inside the minimum distance.

**Rationale**
A directors's job is to keep population matched to demand, not to spawn
an enemy directly on top of a player because that happened to be the only
open space this tick — that would be an unfair ambush, not
rebalancing.
Skipping is always safe: the next tick tries again with
whatever has changed.

**Verification Description**
A unit or integration test packs a zone with players so no point clears
`minSpawnDistFromPlayerPx`, drives a spawn-eligible tick, and asserts no
enemy is created and no error is raised; a test with a valid point
available asserts the spawn occurs there.

## Relations

**Realizes**

- [SYS-TMP-003](SYS-TMP-003-a-scheduled-per-zone-tick-executes-population-allocation-and-gates-despawns-on-sustained-deviation.md)
