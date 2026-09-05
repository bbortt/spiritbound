**Title**
A level increase refills HP/MP to the new max and stamps the level-up timestamp

**Lens**: SW

**Status**: active

**Description**
Only when `computeCharacterLevel(newXp) > character.level` (a genuine
increase, not just an XP gain that stays within the same level) does
`_grantXp` also: set `currentHp`/`currentMp` to the character's new max
(via `buildEffectiveStats`) and stamp `character.lastLevelUpAt` to the
current server timestamp.
On any XP gain that doesn't cross a level
threshold, HP/MP and `lastLevelUpAt` are left untouched.
The client
watches `lastLevelUpAt` changing to trigger the level-up VFX (golden
flash, "LEVEL N" text) and reacts to the resulting HP/MP values rather
than computing the refill itself.

**Rationale**
Ties the "reward" moment (full resources, a stamped and observable event)
specifically to the level threshold, not to every kill — see
`ARCH-005` for why the refill itself must be server-side.

**Verification Description**
A test grants XP that stays within the current level and asserts HP/MP/
`lastLevelUpAt` are unchanged; a second test grants XP that crosses a
level boundary and asserts HP/MP equal the new max and `lastLevelUpAt`
equals the timestamp passed in.

## Relations

**Realizes**

- [SYS-005](SYS-005-killing-enemies-grants-xp-that-levels-up-the-character.md)

**Related**

- [ARCH-005](ARCH-005-hp-mp-refill-on-level-up-is-server-side-not-client.md)
