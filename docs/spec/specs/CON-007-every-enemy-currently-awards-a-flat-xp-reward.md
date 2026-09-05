**Title**
Every enemy currently awards a flat XP reward regardless of difficulty

**Lens**: CON

**Status**: active

**Description**
Every zone-1 enemy's `xpReward` is currently the same flat value (25)
regardless of the enemy's own difficulty (HP, damage, etc.) — there is no
per-enemy-tier scaling yet, because only one enemy tier exists.

**Rationale**
Recorded explicitly as a known, temporary simplification (`CLAUDE.md`'s
Next Steps already calls out "enemy difficulty tiers" as still-needed
work) rather than a deliberate balance decision — this spec exists so a
future multi-tier enemy roster has a clear point to update, not to bless
25-for-everything as correct forever.

**Verification Description**
Reviewed by checking every enemy-seeding site (`_seedZone1Enemies`,
`spawnEnemy`) for its `xpReward` value; this spec should be marked
superseded/updated the moment enemy tiers introduce differentiated
rewards.

## Relations

**Realizes**

- [SYS-005](SYS-005-killing-enemies-grants-xp-that-levels-up-the-character.md)
