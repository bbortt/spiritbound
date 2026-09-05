**Title**
A single 500ms scheduled reducer drives every enemy through a five-state machine stored on its own row

**Lens**: ARCH

**Status**: active

**Description**
One repeating scheduled reducer, `enemyTick` (an Interval schedule that
never deletes its own row), fires every 500ms and steps every enemy
through `idle → chasing → casting → cooldown → resetting`, with the
current state and all transition bookkeeping (`targetCharacterId`,
`castStartedAt`, `lastAttackAt`, `lastSeenTargetAt`) stored directly on
the `Enemy` row.
There is no per-frame simulation loop, and no client
input of any kind feeds into this state.

**Rationale**
SpacetimeDB reducers are not built for a continuous per-frame simulation;
a single shared, coarser 500ms tick across every enemy is an accepted
tradeoff of timing resolution for correctness and simplicity — the client
interpolates visually between ticks rather than the server simulating at
render framerate.

**Verification Description**
Reviewed by confirming `enemyTick` is the only reducer that writes
`aggroState` or an enemy's position, and that the client only reads and
interpolates those fields, never computes or requests a state transition
itself.

## Relations

**Related**

- [STR-003](../stories/STR-003-enemy-ai.md) — the story delivering this decision
