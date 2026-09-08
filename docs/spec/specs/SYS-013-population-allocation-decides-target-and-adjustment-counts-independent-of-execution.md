**Title**
Population allocation decides target and adjustment counts, independent of execution

**Lens**: SYS

**Status**: planned

**Description**
The decision of how many enemies a zone should hold, how that target
splits across level bands given where players are, and what to spawn or
despawn this tick to close the gap, is computed entirely by pure
functions that take player positions, current counts, and zone tuning as
input and return counts and band indices as output — with no dependency
on a scheduled reducer, a database row, or a clock.

**Rationale**
Separating the decision from its execution is what makes the director's
dense set of edge cases (an empty zone, a lone outlier player, a
band-share cap, a deadband boundary) unit-testable in isolation rather
than only observable through a live, ticking reducer — the density of
hard invariants this capability requires (see the story's acceptance
criteria) is exactly the kind of logic `005-testing-contract.md` says
must be pure and covered, not embedded in a reducer.

**Verification Description**
Reviewed via the SW specs this realizes, each independently verifiable by
unit test, including a property test over randomized demand vectors.

## Relations

**Related**

- [STR-012](../stories/STR-012-population-driven-spawn-allocation-rules.md) — the story delivering this capability
- [ARCH-004](ARCH-004-enemy-tick-is-one-scheduled-reducer-driving-a-five-state-machine.md) — the existing precedent for this exact shape: `enemyAi.ts`'s pure decision functions, with `enemyTick` as the thin reducer that calls them and persists the result
