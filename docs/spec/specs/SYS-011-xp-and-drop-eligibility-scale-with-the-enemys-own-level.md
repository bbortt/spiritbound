**Title**
XP and drop eligibility scale with the enemy's own level

**Lens**: SYS

**Status**: active

**Description**
Every enemy carries a `level`.
The XP a kill awards is computed from the
configured base XP and the difference between the player's level and the
enemy's, and the pools a kill may drop from are filtered by the _enemy's_
level plus two — not by the killer's level.

**Rationale**
Flat XP and killer-level drop filtering together made farming trivial mobs
strictly rational: a level-20 player could clear level-2 wolves for full
XP and level-20 gear.
Keying both to the enemy makes the reward describe
what was actually fought, which is the precondition for zones and
difficulty tiers meaning anything.

**Verification Description**
Unit tests over `computeXpReward` in
`spacetimedb/src/rules/leveling.test.ts`, plus review of `damageEnemy`'s
death branch for the enemy-level drop filter.

## Relations

**Related**

- [SYS-005](SYS-005-killing-enemies-grants-xp-that-levels-up-the-character.md) — the XP-from-kills loop this scales
- [SYS-004](SYS-004-enemy-deaths-roll-level-gated-rarity-weighted-ground-drops.md) — the drop roll this re-keys to the enemy

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
