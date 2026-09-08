**Title**
Despawns require sustained over-target deviation; spawns need no such gate

**Lens**: CON

**Status**: planned

**Description**
A band's despawn is only executed once that band has read over its
target population for `sustainedDeviationTicks` consecutive director
ticks, tracked per-band on `zoneDirectorState`.
A single over-target tick,
or a run interrupted by even one under-or-at-target tick, resets the
count.
Spawns carry no equivalent gate — an eligible spawn executes on
the tick it is computed.

**Rationale**
Despawning is destructive and visible if timed wrong; spawning is not.
Requiring several consecutive over-target ticks before a despawn absorbs
transient noise (a few players briefly clustering, then moving on) that
would otherwise trigger removal of an enemy that turns out to still be
needed a tick later.
Spawns have no comparable downside to reacting
immediately.

**Verification Description**
A unit or integration test drives a band over target for
`sustainedDeviationTicks - 1` ticks and asserts no despawn yet, then one
more tick and asserts the despawn executes; a test that drops the band
back to at-or-under target partway through the streak asserts the counter
resets rather than continuing to accumulate.

## Relations

**Realizes**

- [SYS-TMP-003](SYS-TMP-003-a-scheduled-per-zone-tick-executes-population-allocation-and-gates-despawns-on-sustained-deviation.md)
