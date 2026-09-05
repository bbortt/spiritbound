**Title**
_grantXp raises per-life XP and never-resetting lifetime XP in one call

**Lens**: SW

**Status**: active

**Description**
`_grantXp` does two things atomically in one reducer call: adds `amount`
to `character.xp` (per-life — resets to 0 on death/new life, since it
lives on the Character row) and adds the same `amount` to
`accountProgress.totalXpAllLives` (never resets, survives every death,
lives on the account-level row).
It is shared by the kill-XP path in
`damageEnemy` and the public `grantXp` reducer, so there is exactly one
place this logic lives.

**Rationale**
Separating per-life XP (drives the current life's level) from lifetime XP
(an account-wide, un-losable record of total effort) lets permadeath
reset the former without erasing the latter — a player's total
contribution is never wiped by dying.

**Verification Description**
A test asserts both fields increase by exactly `amount` in a single call,
and that a second character's `accountProgress` is untouched.

## Relations

**Realizes**

- [SYS-005](SYS-005-killing-enemies-grants-xp-that-levels-up-the-character.md)
