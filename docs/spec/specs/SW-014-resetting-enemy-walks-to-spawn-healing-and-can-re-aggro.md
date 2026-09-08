**Title**
A resetting enemy walks to spawn while healing and can re-aggro mid-walk

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
What happens to an enemy
that actually died — whether it returns at all, and into which level band
— is not this spec's concern; that outcome is `SW-048`'s.

**Rationale**
Remaining vulnerable to re-aggro while resetting means a player cannot
safely "tag and back off" an enemy repeatedly for free, uncontested
healing right next to it.
Resetting is a retreat, not a death: the enemy
never left play, so the population director has no say in it.

**Verification Description**
A unit test covers the walk-toward-spawn/heal-per-tick/arrive-at-idle
sequence and a mid-reset re-aggro interrupting it.

## Relations

**Realizes**

- [SYS-003](SYS-003-enemies-aggro-chase-and-attack-under-server-authority.md)

**Related**

- [SW-048](SW-048-passive-respawn-retires-an-over-target-enemy-or-re-rolls-it-into-the-neediest-band.md) — owns the death-respawn outcome this spec previously also described

## Changes

- **2026-09-08** — Narrowed to the `resetting` state machine only, dropping
  the death-respawn half ("a dead enemy is restored to full HP at its exact
  spawn position ... regardless of whether any character is nearby, 15
  seconds after death").
  STR-013 makes that outcome conditional: `SW-048`'s
  passive-respawn decision may retire the enemy instead of reviving it, and
  may re-roll its level into a different band, so the unconditional
  restore-at-spawn claim is no longer true and now belongs to `SW-048`.
  The resetting behaviour itself is unchanged, and this narrowing brings the
  spec back in line with its filename slug and with its only two anchors
  (`decideResetting` in `rules/enemyAi.ts` and its test), neither of which
  ever covered the respawn reducer.
  The 15-second cadence itself is
  untouched — only what the reducer does when it fires moves.
