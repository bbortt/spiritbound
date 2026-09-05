**Title**
A resetting enemy walks to spawn while healing, can re-aggro mid-walk, and a dead enemy respawns at full HP exactly 15s later

**Lens**: SW

**Status**: active

**Description**
Each tick in the `resetting` state, the enemy steps
`RESET_SPEED * TICK_SECONDS` px toward its spawn coordinates and heals
`RESET_HP_PER_TICK` HP (capped at `maxHp`).
If a new aggro target comes
within `AGGRO_RANGE` of its new position during this walk, it immediately
transitions to `chasing` targeting that character — reaching spawn first
is not required.
Once it reaches its exact spawn coordinates with no
re-aggro, it transitions to `idle` at full HP.
Separately, a dead enemy
(`alive: false`) is restored to full HP at its exact spawn position and
`idle` state by a one-shot scheduled reducer firing exactly 15 seconds
after death, regardless of whether any character is nearby; the
reducer is a no-op if the enemy is already alive by the time it fires.

**Rationale**
Remaining vulnerable to re-aggro while resetting means a player cannot
safely "tag and back off" an enemy repeatedly for free, uncontested
healing right next to it.
The fixed 15-second death-respawn timer is a
simple, predictable content-availability guarantee — enemies are always
back within a bounded time — rather than a reward for camping the spawn
point.

**Verification Description**
A unit test covers the walk-toward-spawn/heal-per-tick/arrive-at-idle
sequence, a mid-reset re-aggro interrupting it, and the respawn reducer
restoring exactly `maxHp`, spawn position, and `idle` state — and doing
nothing when called against an already-alive enemy.

## Relations

**Realizes**

- [SYS-003](SYS-003-enemies-aggro-chase-and-attack-under-server-authority.md)
