**Title**
XP grant returns zero once the character is at or above the zone's max level

**Lens**: SW

**Status**: planned

**Description**
Before computing any XP reward for a kill, the character's current
zone's `maxLevel` is checked: if `character.level >= zone.maxLevel`, the
grant is zero and `computeXpReward` is never called — this check happens
before, and independent of, the existing level-gap falloff `SW-036`
already computes.

**Rationale**
A zone's level range is a design boundary, not just a suggestion — once a
character has out-levelled it entirely, continuing to earn any XP there
(even a small falling-off amount) undermines the reason zones have a
level range at all.
Checking before `computeXpReward` runs, rather than
clamping its output afterward, keeps the two zero-causes (level gap vs.
zone cap) cleanly separable for the client display logic in
`SW-TMP-013`.

**Verification Description**
A unit test asserts a character at exactly `zone.maxLevel` and one above
it both grant zero XP for a kill; a character one level below
`zone.maxLevel` grants the normal `computeXpReward` amount unaffected by
this check.

## Relations

**Realizes**

- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)

**Related**

- [SW-036](SW-036-xp-falls-off-linearly-between-the-full-xp-band-and-the-zero-cutoff.md) — the level-gap zero case this zone-cap check is independent of
