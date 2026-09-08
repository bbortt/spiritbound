**Title**
Passive respawn retires an over-target enemy or re-rolls it into the neediest band

**Lens**: SW

**Status**: planned

**Description**
A pure function decides what happens when a dead enemy's respawn timer
fires: given its zone's current per-band target and actual counts, if the
band the enemy would return to is at or over its target, the function
signals "retire" (the enemy should be deleted, not respawned); otherwise
it returns the band index across the zone with the largest shortfall
(target minus actual), for the enemy to re-roll its level into.
This
function does not itself touch a database row or a timestamp — it is
called by the respawn reducer with the current band counts already read.

**Rationale**
The brief's own framing names this "the primary rebalancing mechanism" —
most population correction should happen invisibly, at the moment an
enemy would have respawned anyway, rather than through a visible
spawn/despawn pop near a player.
Making the decision a pure function
(rather than inline reducer logic) is what makes this dense, easy-to-get-
wrong decision unit-testable the same way the rest of the allocation
module is.

**Verification Description**
A unit test with the enemy's home band at or over target asserts
"retire"; a unit test with multiple bands under target asserts the band
with the largest shortfall is returned, not simply the enemy's original
band; a unit test with every band at or over target asserts "retire" even
though no band is under target.

## Relations

**Realizes**

- [SYS-TMP-002](SYS-TMP-002-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)

**Related**

- [SW-014](SW-014-resetting-enemy-walks-to-spawn-healing-and-can-re-aggro.md) — **partially superseded**: this spec's respawn half ("a dead enemy is restored to full HP at its exact spawn position... regardless of whether any character is nearby") is replaced by this function's decision; `SW-014`'s resetting-state-machine half (walk to spawn, heal per tick, mid-walk re-aggro) is unaffected and stays active as-is.
Flag for `clew-promote` to narrow `SW-014`'s description to the resetting state only, moving the respawn claim to this spec.
