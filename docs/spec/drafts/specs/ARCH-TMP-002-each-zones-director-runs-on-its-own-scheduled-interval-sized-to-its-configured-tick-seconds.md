**Title**
Each zone's director runs on its own scheduled interval sized to its configured tickSeconds

**Lens**: ARCH

**Status**: planned

**Description**
`spawnDirectorTick` is driven by one scheduled row per zone, each
inserted with `ScheduleAt.interval(zone.director.tickSeconds)`, rather
than a single global interval that internally checks whether enough time
has elapsed for each zone.
The boss cycle, by contrast, stays a single
global 30-second interval shared by every zone, since the brief specifies
a fixed cadence there with no per-zone override.

**Rationale**
A single global tick gating itself per zone would need its own elapsed-
time bookkeeping duplicating what `ScheduleAt.interval` already provides
natively — every zone's cadence is exactly what the scheduler primitive
is for.
This follows the existing per-instance scheduling idiom used for
`enemyRespawnSchedule` (one row per enemy, carrying that enemy's own
payload), extended to interval rather than one-shot scheduling, and keeps
`zoneDirectorState` free to hold only what genuinely needs
cross-tick memory — the sustained-deviation counters — rather than also
tracking each zone's own cadence.

**Verification Description**
Reviewed at `spawnDirectorTick`'s schedule table definition and its
insertion site (in `_doSeedZones` or `init`, once per seeded zone):
confirms one row per zone with that zone's own `tickSeconds`, and that no
gating-by-elapsed-time logic exists inside the reducer itself.

## Relations

**Related**

- [STR-TMP-004](../stories/STR-TMP-004-live-spawn-director-and-boss-cycle.md) — the story this decision serves
- [ARCH-004](ARCH-004-enemy-tick-is-one-scheduled-reducer-driving-a-five-state-machine.md) — the sibling scheduled-reducer precedent this follows, at a different cadence per zone rather than one shared cadence
