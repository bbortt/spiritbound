**Title**
XP grant returns zero once the character is at or above the zone's max level

**Lens**: SW

**Status**: active

**Description**
Before computing any XP reward for a kill, **the killed enemy's zone's**
`maxLevel` is checked: if `character.level >= enemyZone.maxLevel`, the
grant is zero and `computeXpReward` is never called — this check happens
before, and independent of, the existing level-gap falloff `SW-036`
already computes.
The zone is the one the enemy lives in, read from `enemy.zoneId`, not the
one the killer happens to be standing in.

**Rationale**
A zone's level range is a design boundary, not just a suggestion — once a
character has out-levelled it entirely, continuing to earn any XP there
(even a small falling-off amount) undermines the reason zones have a
level range at all.

The gate reads the **enemy's** zone for the same reason `STR-009` moved
drop eligibility onto the enemy's level: the reward belongs to what was
killed and where it lived, not to where the killer was standing when they
killed it.
Keying on the killer's zone would make the identical kill worth a
different amount depending on which side of a border the shot came from,
and would hand a cross-border pull a way around the boundary this spec
exists to draw.

Checking before `computeXpReward` runs, rather than
clamping its output afterward, keeps the two zero-causes (level gap vs.
zone cap) cleanly separable for the client display logic in
`SW-051`.

**Verification Description**
A unit test asserts a character at exactly the enemy zone's `maxLevel` and
one above it both grant zero XP for a kill; a character one level below it
grants the normal `computeXpReward` amount unaffected by this check.

## Relations

**Realizes**

- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)

**Related**

- [SW-036](SW-036-xp-falls-off-linearly-between-the-full-xp-band-and-the-zero-cutoff.md) — the level-gap zero case this zone-cap check is independent of

## Changes

- **2026-09-10** — Corrected "the character's current zone" to the killed
  enemy's zone, and recorded why.
  The text contradicted both `STR-014`'s solution approach and the shipped
  implementation, which reads `enemy.zoneId`.
  The enemy's zone is the right key: XP is a property of what you killed
  and where it lived, matching `STR-009`'s ruling for drop eligibility, and
  it closes the cross-border pull that keying on the killer's position
  would open.
- **2026-09-08** — Set active: implementation of STR-014 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
