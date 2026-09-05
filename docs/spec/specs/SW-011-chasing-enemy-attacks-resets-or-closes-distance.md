**Title**
A chasing enemy checks target loss, then deaggro range, then attack range, before closing distance

**Lens**: SW

**Status**: active

**Description**
Each tick in the `chasing` state, in this exact order: (1) if the target
character no longer exists or is no longer alive, transition to
`resetting`; (2) else if the distance to the target exceeds DEAGGRO_RANGE
(500px), transition to `resetting` (recording `lastSeenTargetAt`); (3)
else if the distance is within ATTACK_RANGE (180px), transition to
`casting` (recording `castStartedAt`); (4) otherwise, step
`CHASE_SPEED * TICK_SECONDS` px toward the target's current position,
snapping exactly onto it rather than overshooting if that step would pass
it.

**Rationale**
A single, ordered branch per tick keeps the state machine simple to reason
about, and gives a fleeing player exactly one lever to end a chase — get
past DEAGGRO_RANGE — with no ambiguity about which condition wins when
several could apply at once.

**Verification Description**
A unit test of the extracted transition logic covers each of the four
branches with fixed enemy/target positions and a dead or missing target,
including boundary values at exactly ATTACK_RANGE and exactly
DEAGGRO_RANGE, and asserts the movement step never exceeds
`CHASE_SPEED * TICK_SECONDS` px and never overshoots the target.

## Relations

**Realizes**

- [SYS-003](SYS-003-enemies-aggro-chase-and-attack-under-server-authority.md)

**Related**

- [CON-003](CON-003-chase-speed-is-always-slower-than-player-move-speed.md)
