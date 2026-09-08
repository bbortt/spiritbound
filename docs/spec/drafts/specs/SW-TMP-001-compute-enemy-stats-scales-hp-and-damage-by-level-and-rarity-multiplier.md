**Title**
computeEnemyStats scales HP and damage by level and a rarity multiplier

**Lens**: SW

**Status**: planned

**Description**
`computeEnemyStats(baseHp, baseDamage, level, rarity, multipliers)` is a
pure function returning `{maxHp, damagePerHit, castDamage}`.
It scales
`baseHp`/`baseDamage` linearly by `level`, then multiplies the result by
`multipliers[rarity].{hp,damage}`. `multipliers` is passed in as a
parameter, sourced by the caller from `content/config.json`'s
`enemies.rarityMultipliers` — the function itself never reads config.
`castDamage` scales identically to `damagePerHit` (a cast is just another
damage source from the same enemy).

**Rationale**
Keeping the multiplier table a caller-supplied parameter, rather than an
import, is what makes this testable in isolation and keeps
`rules/enemyScaling.ts` free of SpacetimeDB/config coupling — the same
convention `rules/drops.ts` and `rules/leveling.ts` already follow for
their config-sourced tuning.

**Verification Description**
A unit test asserts: common rarity at multiplier 1.0/1.0 returns exactly
the level-scaled base with no change; a higher rarity's multiplier scales
both HP and damage by the expected factor; scaling is linear in level
(doubling level roughly doubles the base component); `castDamage` tracks
`damagePerHit`'s scaling.

## Relations

**Realizes**

- [SYS-TMP-001](SYS-TMP-001-enemy-difficulty-scales-with-rarity-as-well-as-level.md)
