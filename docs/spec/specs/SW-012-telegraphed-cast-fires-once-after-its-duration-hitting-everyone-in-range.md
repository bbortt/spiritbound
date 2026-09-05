**Title**
A telegraphed cast fires exactly once, castDurationSeconds after it starts, hitting everyone within attackRangePx at that moment

**Lens**: SW

**Status**: active

**Description**
While `casting`, once the elapsed time since `castStartedAt` reaches
`castDurationSeconds`, the enemy fires its AoE: every alive character in
its zone within `attackRangePx` of the enemy's _current_ position (not its
position when the cast began) takes damage, exactly once for that cast.
The enemy then transitions to `cooldown`, recording `lastAttackAt`, and
clearing `castStartedAt`.
Before the duration has elapsed, no damage
fires, and no partial/repeated firing occurs across multiple ticks once
it has.

**Rationale**
The telegraph a player sees and the damage window are read from the same
server-owned timestamp fields, so they are guaranteed to agree — a player
who moves out of `attackRangePx` before the timer elapses takes no
damage, no matter how the client renders the countdown.
This is the
"preparation over reaction" pillar made mechanically concrete.

**Verification Description**
A unit test asserts no damage fires on a tick before `castDurationSeconds`
has elapsed, fires exactly once on the tick where it has (not again on
subsequent ticks while still transitioning), hits a character exactly at
`attackRangePx`, and misses one just beyond it.

## Relations

**Realizes**

- [SYS-003](SYS-003-enemies-aggro-chase-and-attack-under-server-authority.md)
