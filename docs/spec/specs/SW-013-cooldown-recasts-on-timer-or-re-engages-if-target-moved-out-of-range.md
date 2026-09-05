**Title**
Cooldown re-engages a target that left attack range, or recasts once its timer elapses, but never resets over an in-range target

**Lens**: SW

**Status**: active

**Description**
Each tick in the `cooldown` state, in this exact order: (1) if the target
no longer exists or is no longer alive, transition to `resetting`; (2)
else if the target has moved beyond `ATTACK_RANGE` since the last cast,
transition back to `chasing` (re-engage by closing distance again — not
`resetting`); (3) else, once `attackCooldownSeconds` have elapsed since
`lastAttackAt`, transition to `casting` again (a fresh telegraph,
recording a new `castStartedAt`).
While the target remains alive and in
range with the cooldown timer not yet elapsed, the enemy stays in
`cooldown` and does nothing.

**Rationale**
Distinguishes "the target stepped just out of hitting range" (chase it
back into range) from "the target is gone or far beyond aggro entirely"
(give up, handled by `resetting`) — a small in-range repositioning during
the enemy's recovery window should not discard the whole encounter and
force it to walk home.

**Verification Description**
A unit test covers each of the three branches with fixed
target-distance/elapsed-time inputs, including the boundary at exactly
`ATTACK_RANGE` and exactly `attackCooldownSeconds` elapsed.

## Relations

**Realizes**

- [SYS-003](SYS-003-enemies-aggro-chase-and-attack-under-server-authority.md)

**Related**

- [SW-011](SW-011-chasing-enemy-attacks-resets-or-closes-distance.md)
