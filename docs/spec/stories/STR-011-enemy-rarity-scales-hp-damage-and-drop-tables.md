**Title**
Enemy rarity scales HP, damage, and drop tables

**Status**: active

**Business Value**
Every enemy today is the same fight at a different number: `CON-007`
already retired flat XP, but HP and damage are still flat 100/8 regardless
of level or content design intent — `docs/BALANCE.md` names this the
remaining placeholder.
Giving enemies a rarity that scales both their
combat stats and their drop table is what makes a rare/epic spawn or a
zone boss actually feel different to fight, not just a bigger XP number,
and is the data hook the spawn-director and boss-cycle stories in this
increment need to place harder enemies deliberately.

**Problem / Context**
The `enemy` table has no `rarity` or `isBoss` column — every row is one
undifferentiated archetype. `rules/drops.ts` weights a drop roll by the
_dropped item's_ rarity, but nothing about the _killing enemy_ raises or
lowers that roll's floor, so a rare enemy and a common enemy currently
offer identical odds.

**Solution Approach**
Add `rarity: TRarity` and `isBoss: bool` columns to the `enemy` table.
Add a new pure module `rules/enemyScaling.ts` with `computeEnemyStats`,
which scales a base HP/damage linearly by level and then multiplies by a
per-rarity multiplier table.
That multiplier table is operator-tunable
config (`content/config.json`, under `enemies.rarityMultipliers`) threaded
into the pure function as a parameter — the same pattern `rules/drops.ts`
already uses for `CONFIG.dropRates.*` — not a hardcoded constant, per
`ARCH-010`.

Add a second pure function to `rules/drops.ts` that shifts a rarity-tier
weight table for a non-common mob: the common tier's weight is zeroed and
redistributed into the other tiers _proportional to their existing
relative weight_.
Because the shipped table's legendary weight is exactly
0, and proportional redistribution of a zero share stays zero, this shift
can never make legendary reachable — `CON-004`'s "legendary weight is
fixed at zero" holds unchanged even for a boss kill.
Unlocking legendary
drops for bosses specifically is a real, live tension with `CON-004`'s own
rationale ("reserved for bosses ... neither of which exist yet") but is
explicitly deferred, not decided here — see Out of scope.

**Acceptance Criteria**

- `enemy.rarity` and `enemy.isBoss` exist and are seeded on every spawned
  enemy.
- `computeEnemyStats(baseHp, baseDamage, level, rarity, multipliers)`
  returns HP and damage scaled linearly by level and multiplied by the
  rarity's configured `{hp, damage}` multiplier; common at any level
  returns exactly the level-scaled base (multiplier 1.0/1.0).
- The drop-tier-shift function, given a non-common mob rarity, returns a
  weight table whose common weight is 0 and whose other four weights sum
  to 1.0; given a common mob rarity, it returns the input table unchanged.
- A tier whose weight is 0 before the shift is still 0 after the shift, at
  every mob rarity.
- `content/config.json`'s `enemies.rarityMultipliers` table covers all
  five rarities, rejecting a config where any multiplier is below 1.0 or
  where multipliers do not increase from common through legendary.

**Out of scope**

- Deciding whether/when legendary loot becomes reachable at all — that
  remains `CON-004`'s call, unchanged by this story.
  If a future story
  wants boss kills to unlock legendary, it must explicitly revisit
  `CON-004`, not rely on this story's proportional shift to do it
  implicitly.
- An `EnemyDefinition` content table — see `ARCH-012`'s rationale for
  why this story keeps enemies as flat, code-seeded rows.
- Actually spawning enemies with a chosen rarity at runtime (the spawn
  director story) and the boss spawn/despawn cycle (the boss-cycle
  story) — this story only adds the scaling math and the schema columns
  they will use.

## Relations

**Realizes**

- [SYS-012](../specs/SYS-012-enemy-difficulty-scales-with-rarity-as-well-as-level.md)
- [ARCH-012](../specs/ARCH-012-enemy-rarity-and-boss-flag-are-columns-on-the-flat-enemy-row.md)
- [SW-039](../specs/SW-039-compute-enemy-stats-scales-hp-and-damage-by-level-and-rarity-multiplier.md)
- [SW-040](../specs/SW-040-a-non-common-mob-shifts-its-drop-weights-toward-higher-rarity-tiers.md)
- [CON-026](../specs/CON-026-rarity-multipliers-cover-every-rarity-at-or-above-one-increasing-by-tier.md)

**Related**

- [CON-004](../specs/CON-004-legendary-drop-weight-is-zero.md) — unaffected by the shift; see Solution Approach
- [CON-005](../specs/CON-005-empty-rarity-tier-falls-back-to-full-pool-empty-pool-drops-nothing.md) — the fallback the shifted table still needs
- [SW-017](../specs/SW-017-a-rarity-tier-is-weight-picked-then-sampled-within-tier.md) — the roll this shifted table feeds
- [CON-007](../specs/CON-007-every-enemy-currently-awards-a-flat-xp-reward.md) — the sibling flat-stat placeholder this story addresses for HP/damage
- [ARCH-010](../specs/ARCH-010-config-json-is-operator-tunable-cards-and-equipment-json-are-content.md) — why `rarityMultipliers` lives in config.json
