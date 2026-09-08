**Title**
A scheduled per-zone tick executes population allocation and gates despawns on sustained deviation

**Lens**: SYS

**Status**: planned

**Description**
Each zone runs its own scheduled `spawnDirectorTick`, on its own cadence,
that reads live player and enemy state, calls the pure allocation
functions, and executes the result: spawns happen as soon as they're
computed and a valid point exists; despawns only execute once a band has
read over its target for several consecutive ticks in a row, so a single
noisy tick never removes an enemy a player might be standing near.

**Rationale**
Population correction has to actually run against live state, not just
exist as pure math — this is the capability that makes the previous
story's decisions observable in play.
Gating despawns on sustained
deviation (not spawns) is the deliberate asymmetry that keeps the map
feeling stable rather than twitchy: an area can be briefly over-populated
without consequence, but never suddenly empty.

**Verification Description**
Reviewed via the CON specs this realizes, each independently verifiable;
an integration test in `spacetimedb/integration/` exercises at least one
deterministic scenario (e.g. a band held over target for exactly the
configured number of ticks triggers a despawn on the following tick, not
before).

## Relations

**Related**

- [STR-013](../stories/STR-013-live-spawn-director-and-boss-cycle.md) — the story delivering this capability
- [SYS-013](SYS-013-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md) — the pure decision logic this tick executes
