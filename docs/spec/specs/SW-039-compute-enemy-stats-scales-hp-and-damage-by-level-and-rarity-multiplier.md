**Title**
computeEnemyStats scales HP and damage by level and a rarity multiplier

**Lens**: SW

**Status**: active

**Description**
`computeEnemyStats(baseHp, baseDamage, level, rarity, scaling)` is a
pure function returning `{maxHp, damagePerHit, castDamage}`.
It scales
`baseHp`/`baseDamage` linearly by `level`, then multiplies the result by
`scaling.rarityMultipliers[rarity].{hp,damage}`.
`castDamage` is `damagePerHit`'s unrounded product multiplied by
`scaling.castDamageRatio` — so a cast scales with level and rarity exactly
as a swing does, but always lands harder than one (`CON-034`).
`scaling` is passed in as a parameter, sourced by the caller from
`content/config.json`'s `enemies` block — the function itself never reads
config.

**Rationale**
Keeping the dials caller-supplied, rather than imported, is what makes this
testable in isolation and keeps `rules/enemyScaling.ts` free of
SpacetimeDB/config coupling — the same convention `rules/drops.ts` and
`rules/leveling.ts` already follow for their config-sourced tuning.
They arrive as one `scaling` object rather than one parameter per dial so
that adding a dial does not change the function's arity, and so a caller
cannot pair a ratio from one config with a multiplier table from another.

`castDamage` is a ratio rather than a second authored number because the
differential — not the absolute figure — is what makes a telegraph worth
dodging, and a ratio survives any retune of `baseDamage` without a second
edit.
Rounding it from the unrounded damage product rather than from the rounded
`damagePerHit` keeps a small base from compounding two roundings into a
visibly wrong differential.

**Verification Description**
A unit test asserts: the shipped config's archetype base, scaled to the
seeded zone-1 level and common rarity, reproduces the enemy the reducer
spawns by hand today (100 HP / 8 per swing / 15 per cast); common rarity at
multiplier 1.0/1.0 returns the level-scaled base unchanged; a higher
rarity's multiplier scales both HP and damage by the expected factor;
scaling is linear in level (doubling level doubles the base component);
`castDamage` equals the damage product times `castDamageRatio` at every
rarity and stays strictly above `damagePerHit`; and passing a flat table
with a ratio of 1 proves the function reads its dials from the parameter
rather than from config.

## Relations

**Realizes**

- [SYS-012](SYS-012-enemy-difficulty-scales-with-rarity-as-well-as-level.md)

**Related**

- [CON-034](CON-034-a-telegraphed-cast-never-hits-softer-than-a-melee-swing.md)

## Changes

- **2026-09-10** — Replaced the `multipliers` parameter with a `scaling`
  object carrying both `rarityMultipliers` and a new `castDamageRatio`, and
  corrected "castDamage scales identically to damagePerHit".
  The text was wrong about the implementation and about the design: the
  shipped enemy deals 8 per swing and 15 per cast, so casts never scaled
  identically, and they must not — the differential is the telegraph
  mechanic.
  The ratio moves to `content/config.json` because it is a feel dial an
  operator should be able to turn, and it is bounded at 1.0 by `CON-034` so
  that "a cast that hits softer than a swing" is unrepresentable rather than
  merely discouraged.
  Widening the fifth parameter's type instead of adding a sixth keeps the
  signature's arity stable.
- **2026-09-08** — Set active: implementation of STR-011 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
