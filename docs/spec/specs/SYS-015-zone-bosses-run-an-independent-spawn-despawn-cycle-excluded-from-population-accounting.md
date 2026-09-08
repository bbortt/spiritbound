**Title**
Zone bosses run an independent spawn/despawn cycle, excluded from population accounting

**Lens**: SYS

**Status**: planned

**Description**
A zone with a configured boss runs a spawn/despawn cycle entirely
separate from the population director: the boss appears at a fixed point
for a limited window on a recurring schedule, regardless of the zone's
band population state, and never counts toward that state either.

**Rationale**
A boss is a scheduled encounter, not part of the ambient population the
director manages — it must be exempt from every part of that accounting
(band demand, target, actual count) or its presence would distort the
director's decisions for ordinary enemies in the same band, and its own
lifecycle (a strict window, not idle/HP/distance gated like a normal
despawn) needs rules the ambient director's despawn gate doesn't apply.

**Verification Description**
Reviewed via the CON/SW specs this realizes, each independently
verifiable; an integration test spawns a boss, advances past its window,
and asserts it is deleted regardless of damage taken, and that a
concurrent director tick's band counts are unaffected by its presence.

## Relations

**Related**

- [STR-013](../stories/STR-013-live-spawn-director-and-boss-cycle.md) — the story delivering this capability
