# Spiritbound — Balance Reference

Shared numeric reference for `ability-balancer` and `item-balancer`. This is
where hard-coded constants get a name and a home so they stop drifting
silently between `rules/`, `spacetimedb/src/index.ts`, and this doc. Every
number below is a **stub pending real playtest data** unless marked
otherwise — treat them as "currently shipped," not "correct forever."

## Character level XP curve

Implemented in `spacetimedb/src/rules/death.ts#computeCharacterLevel`:

```
level = clamp(1, 50, floor((xp / 80) ^ 0.55))
```

Placeholder power curve. Design goal (per `GAME_DESIGN.md`): 1–10 fast,
10–30 medium, 30–50 slower, with post-death re-leveling taking ~40–50% of
the original time. **Not yet validated against that goal — pending
playtest.**

## Spirit level (bond XP) curve

Implemented in `spacetimedb/src/rules/death.ts#computeSpiritLevel`:

```
level = clamp(1, 50, floor(log10(bondXp + 1) * 17))
```

Rough anchors: ~100 XP ≈ level 1, ~10,000 XP ≈ level 10, ~1,000,000 XP ≈
level 50. Log-shaped so early levels feel fast. **Pending playtest.**

### Sacrifice XP (feeding a card to a spirit)

`spacetimedb/src/rules/death.ts#SACRIFICE_XP` — burning a card of a given
rarity for spirit bond XP:

| Rarity    | XP awarded |
| --------- | ---------: |
| common    |         10 |
| uncommon  |         50 |
| rare      |        200 |
| epic      |        800 |
| legendary |      3,000 |

### Hand slots by spirit level

`rules/death.ts#computeHandSlots`:

```
active  = min(10, 2 + floor(spiritLevel * 0.2))   // 2 at level 1 → 10 at level 40
passive = min(5,  1 + floor(spiritLevel * 0.1))   // 1 at level 1 → 5  at level 40
```

### Attunement slots by spirit level (death retention)

`rules/death.ts#computeAttunementSlots` — how many cards of each rarity
survive death if attuned:

```
common:    min(8, floor(level * 0.6) + 1)
uncommon:  min(6, floor(level * 0.4))
rare:      min(4, floor(level * 0.2))
epic:      min(2, floor(level * 0.08))
legendary: level >= 30 ? 1 : 0
```

Legendary attunement deliberately locked behind spirit level 30 — "you
cannot hoard 10 legendaries."

## Stat conversion anchors

Placeholder — pending playtest. No numeric conversion rates (e.g. how much
`accuracy` is needed to fully counter a given `evasion`) have been decided
yet beyond the formula shape in `rules/combat.ts` (see below). Needs real
numbers once combat is played at scale.

## Card balance constants

`spacetimedb/src/rules/combat.ts` — used by `resolveHit` / `resolveHeal`:

| Constant                  | Value | Meaning                                                                                       |
| ------------------------- | ----: | --------------------------------------------------------------------------------------------- |
| `LEVEL_SCALING_PER_LEVEL` |  0.05 | Each character level adds 5% of a card's base power.                                          |
| `CRIT_MULTIPLIER`         |   1.5 | Damage multiplier on a crit roll.                                                             |
| `MAX_GLANCING_REDUCTION`  |  0.20 | Evasion/parry/magic-resist caps at 20% damage reduction — glancing blow, never full negation. |
| `MIN_DAMAGE`              |     1 | Damage floor after all mitigation.                                                            |

Accuracy-vs-avoidance interaction is currently `effectiveAvoidance =
max(0, rawAvoidance - accuracyStat * 0.002)` — the `0.002` conversion rate is
a placeholder, not a tuned value.

## Enemy balance values

`spacetimedb/src/index.ts` — chase-AI tuning constants (module-level,
shared by every enemy) plus current per-enemy seed values:

| Constant            |   Value | Meaning                                                                           |
| ------------------- | ------: | --------------------------------------------------------------------------------- |
| `AGGRO_RANGE`       |   300px | Distance at which an idle enemy notices a player.                                 |
| `ATTACK_RANGE`      |   180px | Distance at which a chasing enemy stops and casts.                                |
| `DEAGGRO_RANGE`     |   500px | Distance at which a chasing/cooldown enemy gives up and resets.                   |
| `CHASE_SPEED`       | 110px/s | Always slower than the player's 180px/s move speed — a chase is always escapable. |
| `RESET_SPEED`       |  80px/s | Walk-back-to-spawn speed while resetting.                                         |
| `RESET_HP_PER_TICK` |   10 HP | Healed per tick (every 500ms) while resetting.                                    |
| `TICK_SECONDS`      |    0.5s | `enemyTick` cadence.                                                              |

Current seeded enemy stats (`_seedZone1Enemies` / `spawnEnemy`, zone 1):

| Field                   |  Value |
| ----------------------- | -----: |
| `currentHp` / `maxHp`   |    100 |
| `damagePerHit`          |      8 |
| `attackRangePx`         |  220px |
| `attackCooldownSeconds` |   3.0s |
| `castDurationSeconds`   |   1.8s |
| `castShape`             | circle |
| `castDamage`            |     15 |

All of the above are first-pass placeholder values, not balanced against
real player stats yet.

## Drop rates

`spacetimedb/src/index.ts` — top-of-file named constants:

```
CARD_DROP_CHANCE = 0.25   // was 0.70
ITEM_DROP_CHANCE = 0.20   // was 0.40
```

`_dropCardFromEnemy` rolls `CARD_DROP_CHANCE` per enemy death; on a hit, the
eligible pool is `cardDefinition` rows with `minCharacterLevel <= killer's
level`, then a rarity tier is picked via `_pickWeightedRarity` before
sampling within that tier:

| Rarity    | Weight |
| --------- | -----: |
| common    |    60% |
| uncommon  |    25% |
| rare      |    12% |
| epic      |     3% |
| legendary |     0% |

**Legendary cards never drop from trash mobs** — the weight is 0 by design;
they're reserved for bosses and dungeon tiers (not yet implemented). If the
picked tier has no eligible cards at the killer's level, selection falls
back to the full eligible pool; if that's empty too, the enemy drops
nothing rather than erroring.

`_dropItemFromEnemy` follows the identical shape: `ITEM_DROP_CHANCE` roll,
then `itemDefinition` rows filtered by `minLevel <= killer's level`, same
rarity-weighted tier pick and same nothing-rather-than-error fallback.

Ground drops despawn 60s after `createdAt` (swept by `cardDropCleanup`,
every 10s). Pickup requires being within 80px (`pickupCard` / `pickupItem`).

**Duplicates are intentional, not a bug.** A second copy of a card you
already own is merge fuel (future merge system) and spirit-sacrifice fodder
(`SACRIFICE_XP` above, live today). They currently feel like dead weight
only because the merge UI doesn't exist yet — that's a missing feature, not
a reason to suppress duplicate drops.

**Placeholder** — owned by `item-balancer` long-term; not yet tuned against
an economy model. The percentages above are a first rebalance pass (down
from 70%/40%) to make drops feel earned rather than guaranteed; still
pending real playtest data.

## XP from kills

`spacetimedb/src/index.ts` — `enemy.xpReward` (`u64`, default `25n` for
every zone-1 enemy, set on both `_seedZone1Enemies` and `spawnEnemy`) is
awarded to the killing character in `damageEnemy` when an enemy's HP hits
0, via a shared `_grantXp(ctx, character, amount)` helper (also used by the
public `grantXp` reducer). `_grantXp`:

- increases `character.xp` (per-life, resets on death)
- increases `accountProgress.totalXpAllLives` (never resets, survives death)
- recomputes level via `computeCharacterLevel` (see the character level XP
  curve above) and, on a level increase, refills `currentHp`/`currentMp` to
  the character's max and stamps `character.lastLevelUpAt` — the client
  watches that field to trigger the level-up flash/text.

flat `25` XP per kill is a placeholder — no scaling by enemy difficulty
yet, since only one enemy tier exists. See `docs/ARCHITECTURE.md` for the
client/server level-curve duplication this feature depends on.

## Race base stats (vertical slice)

`spacetimedb/src/rules/stats.ts#computeRaceBase` — one hard-coded human
placeholder, ignores its `raceId` argument. This is the character's stat
floor before any gear:

| Field                                                 | Value | Field           | Value |
| ----------------------------------------------------- | ----: | --------------- | ----: |
| power / knowledge / will / agility / precision        |    10 | health          |    12 |
| maxHp                                                 |   100 | maxMp           |    60 |
| hpRegen                                               |   0.5 | mpRegen         |   0.3 |
| moveSpeed / attackSpeed / castingSpeed / healingBoost |   1.0 | everything else |     0 |

**Behavior change:** `startLife` used to grant `100 + level*15` HP and
`50 + level*8` MP (character level scaled starting resources directly).
That placeholder is gone — a fresh character now always starts at exactly
`computeRaceBase(0)`'s maxHp/maxMp (100/60) regardless of level, matching
`GAME_DESIGN.md`'s stat model (Health/Will are race-seeded primaries, not
level-seeded). Character level now only scales card damage
(`LEVEL_SCALING_PER_LEVEL` above) — HP/MP growth is gear's job. Flagging
this since it's a real gameplay-feel change, not just plumbing.

## Bare weapon swing (no card)

`spacetimedb/src/index.ts#damageEnemy` — `cardDefId: 0` means a bare weapon
swing (right-click basic attack, no card cast). It's fed through the same
`resolveHit` pipeline as a card cast, with `cardBasePower` set to the
attacker's `weaponDamage` stat (0 unarmed) instead of a card's `basePower`,
and `cardSchool`/`cardBaseShape` taken from the equipped main_hand weapon
(defaults: physical, cone, width 0.4, range 150 if bare-handed). This is a
judgment call — `resolveHit` itself doesn't consume `weaponDamage` anywhere
else (card casts still scale off `physicalAttack`/`magicAttack` only, per
`GAME_DESIGN.md`'s stat table), so `weaponDamage` would otherwise be a
dead stat on every weapon in `equipment.json`.

## Starter equipment (vertical slice)

`content/equipment.json` — 6 common/uncommon items seeded via `seedItems`.
No stat budget table exists yet (no gear drops or equip flow live), so these
are first-pass numbers, not budget-derived. Validated only against the
structural rules in `content/validateEquipment.ts` (main_hand needs full
geometry, armorWeight null on weapons/off_hand, evasion < 0.20, moveSpeed <
0.5, epic/legendary stat floors, and the power-vs-area rule below).

| Item              | Slot      | Rarity   | Weight/Geometry              | Stat line                                          |
| ----------------- | --------- | -------- | ---------------------------- | -------------------------------------------------- |
| Worn Dagger       | main_hand | common   | cone, width 0.3, range 120   | weaponDamage 12, physicalAttack 8, attackSpeed 1.1 |
| Apprentice Staff  | main_hand | common   | circle, width 1.8, range 280 | weaponDamage 6, magicAttack 14, castingSpeed 1.1   |
| Leather Cap       | head      | common   | cloth                        | magicDef 8, maxHp 15                               |
| Iron Chestplate   | chest     | common   | plate                        | physicalDef 18, maxHp 30                           |
| Traveller's Boots | boots     | common   | chain                        | moveSpeed 0.08, evasion 0.03                       |
| Spirit Focus      | off_hand  | uncommon | —                            | magicDef 10, magicResist 0.05, maxMp 25            |

**Power-vs-area rule (main_hand only):** if `geometryWidth > 1.0`, then
`weaponDamage + physicalAttack + magicAttack` must not exceed 20. Apprentice
Staff sits exactly at the boundary (6 + 14 = 20, width 1.8) — the validator
enforces `<= 20` (not a strict `<`) specifically so this starter item stays
legal; tightening this to a strict `<` would retroactively break it. Flagged
here rather than silently choosing one reading, since it's a real judgment
call `item-balancer` may want to revisit once a real stat budget exists.
