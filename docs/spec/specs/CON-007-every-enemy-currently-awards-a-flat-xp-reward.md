**Title**
Every enemy currently awards a flat XP reward regardless of difficulty

**Lens**: CON

**Status**: deprecated

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

## Changes

- **2026-09-05** — Deprecated by STR-009.
  This spec recorded the flat 25-XP-per-kill value as a temporary
  simplification and named enemy tiers as the trigger that would retire it.
  STR-009 retires it from the other side: the reward is now computed from
  the configured base XP and the player-to-enemy level difference
  (`SW-036`), and the enemy row no longer carries an `xpReward` column at
  all, so there is no flat per-enemy reward left to record.
  Differentiated
  per-enemy _difficulty_ (HP, damage) remains unbuilt and stays out of
  scope.
