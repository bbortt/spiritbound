# Spiritbound — Balance Reference

Shared numeric reference for `ability-balancer` and `item-balancer`.
This is
where hard-coded constants get a name and a home so they stop drifting
silently between `rules/`, `spacetimedb/src/index.ts`, and this doc.
Every
number below is a **stub pending real playtest data** unless marked
otherwise — treat them as "currently shipped," not "correct forever."

> **Where the numbers actually live.** Drop rates, rarity weights, XP tuning,
> ground-drop lifetime/pickup range, and the enemy AI ranges and speeds are no
> longer constants in `rules/` or `index.ts` — they are **server-operator
> dials in `content/config.json`**, validated at module load by
> `content/validateConfig.ts` (see `ARCH-010`).
> This document explains and
> justifies the shipped values; `content/config.json` **is** the values.
> When
> they disagree, the JSON wins and this file needs updating.

## Character level XP curve

Implemented in `spacetimedb/src/rules/death.ts#computeCharacterLevel`:

```text
level = clamp(1, 50, floor((xp / 80) ^ 0.55))
```

Placeholder power curve.
Design goal (per `GAME_DESIGN.md`): 1–10 fast,
10–30 medium, 30–50 slower, with post-death re-leveling taking ~40–50% of
the original time. **Not yet validated against that goal — pending
playtest.**

## Spirit level (bond XP) curve

Implemented in `spacetimedb/src/rules/death.ts#computeSpiritLevel`:

```text
level = clamp(1, 50, floor(log10(bondXp + 1) * 17))
```

Rough anchors: ~100 XP ≈ level 1, ~10,000 XP ≈ level 10, ~1,000,000 XP ≈
level 50.
Log-shaped so early levels feel fast. **Pending playtest.**

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

```text
active  = min(10, 2 + floor(spiritLevel * 0.2))   // 2 at level 1 → 10 at level 40
passive = min(5,  1 + floor(spiritLevel * 0.1))   // 1 at level 1 → 5  at level 40
```

### Attunement slots by spirit level (death retention)

`rules/death.ts#computeAttunementSlots` — how many cards of each rarity
survive death if attuned:

```text
common:    min(8, floor(level * 0.6) + 1)
uncommon:  min(6, floor(level * 0.4))
rare:      min(4, floor(level * 0.2))
epic:      min(2, floor(level * 0.08))
legendary: level >= 30 ? 1 : 0
```

Legendary attunement deliberately locked behind spirit level 30 — "you
cannot hoard 10 legendaries."

## Stat conversion anchors

Placeholder — pending playtest.
No numeric conversion rates (e.g. how much
`accuracy` is needed to fully counter a given `evasion`) have been decided
yet beyond the formula shape in `rules/combat.ts` (see below).
Needs real
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

Chase-AI tuning, shared by every enemy.
These five live in
`content/config.json` under `enemies` and are passed into the pure decision
functions in `rules/enemyAi.ts` as an `EnemyAiTuning` parameter:

| `config.json` key    |   Value | Meaning                                                                           |
| -------------------- | ------: | --------------------------------------------------------------------------------- |
| `aggroRangePx`       |   300px | Distance at which an idle enemy notices a player.                                 |
| `attackRangePx`      |   180px | Distance at which a chasing enemy stops and casts.                                |
| `deaggroRangePx`     |   500px | Distance at which a chasing/cooldown enemy gives up and resets.                   |
| `chaseSpeedPxPerSec` | 110px/s | Always slower than the player's 180px/s move speed — a chase is always escapable. |
| `resetSpeedPxPerSec` |  80px/s | Walk-back-to-spawn speed while resetting.                                         |
| `respawnSeconds`     |     15s | Delay before a dead enemy respawns at its spawn point.                            |

Two remain code constants in `rules/enemyAi.ts`, because they are not balance
dials — they are tied to the tick loop itself:

| Constant            | Value | Meaning                                        |
| ------------------- | ----: | ---------------------------------------------- |
| `RESET_HP_PER_TICK` | 10 HP | Healed per tick (every 500ms) while resetting. |
| `TICK_SECONDS`      |  0.5s | `enemyTick` cadence.                           |

> **`chaseSpeedPxPerSec` is now operator-editable, and the config schema does
> not enforce `CON-003`** ("chase speed is always slower than player move
> speed").
> The shipped value honours it and `enemyAi.test.ts` asserts that;
> a modified deployment can still break it.
> See `ARCH-010`.

Current seeded enemy stats (`_seedZone1Enemies` / `spawnEnemy`, zone 1):

| Field                   |  Value |
| ----------------------- | -----: |
| `level`                 |      2 |
| `currentHp` / `maxHp`   |    100 |
| `damagePerHit`          |      8 |
| `attackRangePx`         |  220px |
| `attackCooldownSeconds` |   3.0s |
| `castDurationSeconds`   |   1.8s |
| `castShape`             | circle |
| `castDamage`            |     15 |

`level` drives both the XP reward and the drop-pool gate (see below).
It is
the only per-enemy difficulty signal so far — HP and damage are still flat
across every enemy.

All of the above are first-pass placeholder values, not balanced against
real player stats yet.

## Drop rates

**Drop rates now live in `content/config.json`** under `dropRates`, not as
constants in `index.ts`.
Each category carries its own base chance and its
own rarity weight table, which the validator requires to sum to 1.0:

| `config.json` key            | Value |
| ---------------------------- | ----: |
| `dropRates.cards.baseChance` |  0.25 |
| `dropRates.gear.baseChance`  |  0.20 |

| Rarity    | Cards | Gear |
| --------- | ----: | ---: |
| common    |   60% |  65% |
| uncommon  |   25% |  22% |
| rare      |   12% |  10% |
| epic      |    3% |   3% |
| legendary |    0% |   0% |

**Legendary never drops from trash mobs** — the weight is 0 by design; those
are reserved for bosses and dungeon tiers (not yet implemented).
Note that
this is now an operator-editable number: the schema does **not** enforce
`CON-004`, and `content/config.test.ts` is what holds it for the shipped
values (see `ARCH-010`).

`_dropCardFromEnemy` rolls `dropRates.cards.baseChance` per enemy death; on a
hit the eligible pool is `cardDefinition` rows with
`minCharacterLevel <= enemy.level + 2`, then a rarity tier is picked by
weight before sampling within that tier.
`_dropItemFromEnemy` is the
identical shape over `itemDefinition` rows filtered by
`minLevel <= enemy.level + 2`.
If the picked tier has no eligible entries,
selection falls back to the full eligible pool; if that is empty too, the
enemy drops nothing rather than erroring.

**Eligibility is keyed to the ENEMY's level, not the killer's** (changed in
`STR-009`, superseding `SW-016`).
Filtering by the killer made a high-level
player a loot multiplier over low-level mobs — the same wolf dropped level-20
gear for a veteran and level-1 gear for a newcomer.
The `+2` is headroom
inside the enemy's own band, so a zone's tier stays reachable.

Ground drops despawn after `drops.despawnSeconds` (60s) from `createdAt`
(swept by `cardDropCleanup`, every 10s).
Pickup requires being within
`drops.pickupRangePx` (80px) — `pickupCard` / `pickupItem`.

**Duplicates are intentional, not a bug.** A second copy of a card you
already own is merge fuel (future merge system) and spirit-sacrifice fodder
(`SACRIFICE_XP` above, live today).
They currently feel like dead weight
only because the merge UI doesn't exist yet — that's a missing feature, not
a reason to suppress duplicate drops.

**Placeholder** — owned by `item-balancer` long-term; not yet tuned against
an economy model.
The percentages above are a first rebalance pass (down
from 70%/40%) to make drops feel earned rather than guaranteed; still
pending real playtest data.

## XP from kills

The reward is **computed per kill**, not stored on the enemy row.
`damageEnemy` calls
`computeXpReward(config.xp.baseMonsterXp, enemy.level, character.level,
config.xp.levelDiffPenalty)` (`rules/leveling.ts`) and grants the result via
the shared `_grantXp(ctx, character, amount)` helper (also used by the public
`grantXp` reducer).

| `config.json` key                         | Value |
| ----------------------------------------- | ----: |
| `xp.baseMonsterXp`                        |    25 |
| `xp.levelDiffPenalty.fullXpWithinLevels`  |     2 |
| `xp.levelDiffPenalty.zeroXpBeyondLevels`  |     8 |
| `xp.levelDiffPenalty.higherLevelBonusCap` |   1.5 |

With `diff = playerLevel - monsterLevel`:

| Situation                    | Reward                                     |
| ---------------------------- | ------------------------------------------ |
| `diff <= 0` (enemy at/above) | `base × (1 + min(cap-1, abs(diff) × 0.1))` |
| `0 < diff <= 2`              | full `base`                                |
| `2 < diff < 8`               | linear falloff from `base` to 0            |
| `diff >= 8`                  | 0 — shown to the player as a grey "No XP"  |

**The above-level bonus is capped at ×1.5 on purpose** (`CON-018`).
Under
permadeath the reward curve is also a risk curve: an uncapped bonus would make
pulling far above your level the fastest progression right up to the death
that ends the character.
The cap keeps fighting up worthwhile without making
it optimal.
At 0.1/level the cap is reached 5 levels above the player.

`_grantXp`:

- increases `character.xp` (per-life, resets on death)
- increases `accountProgress.totalXpAllLives` (never resets, survives death)
- recomputes level via `computeCharacterLevel` (see the character level XP
  curve above) and, on a level increase, refills `currentHp`/`currentMp` to
  the character's max and stamps `character.lastLevelUpAt` — the client
  watches that field to trigger the level-up flash/text.

`baseMonsterXp` is still a single flat number for every enemy — the level
gap scales it, but enemy _difficulty_ tiers (varying HP/damage) do not exist
yet, so a level-2 enemy and a future level-2 elite would pay the same.
That
is the remaining placeholder here.

See `docs/ARCHITECTURE.md` for the two client/server duplications this
feature depends on: the level curve (`ARCH-006`) and `computeXpReward` plus
its config block (`ARCH-011`), which the client needs to render the floating
reward number now that the enemy row no longer carries it.

## Spirit rarity ceiling

`rules/death.ts` — `computeRarityCeiling(spiritLevel)`.
The highest card
rarity a spirit can equip or attune **at all**:

| Spirit level | Ceiling   |
| ------------ | --------- |
| 1–4          | common    |
| 5–11         | uncommon  |
| 12–24        | rare      |
| 25–39        | epic      |
| 40+          | legendary |

These sit deliberately _below_ the attunement thresholds for the same tiers
(a first rare attunement slot arrives around spirit level 10, the legendary
slot at 30, against a legendary ceiling at 40).
The gap is the design: a
player wields a tier for a stretch of levels before they can protect it, so
an above-tier card is a risk before it is an asset.
See `CON-017` and the
"two spirit gates" note in `GAME_DESIGN.md`.

Not yet tuned against playtest data — the step levels are a first pass.

## Race base stats (vertical slice)

`spacetimedb/src/rules/stats.ts#computeRaceBase` — one hard-coded human
placeholder, ignores its `raceId` argument.
This is the character's stat
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
level-seeded).
Character level now only scales card damage
(`LEVEL_SCALING_PER_LEVEL` above) — HP/MP growth is gear's job.
Flagging
this since it's a real gameplay-feel change, not just plumbing.

## Bare weapon swing (no card)

`spacetimedb/src/index.ts#damageEnemy` — `cardDefId: 0` means a bare weapon
swing (right-click basic attack, no card cast).
It's fed through the same
`resolveHit` pipeline as a card cast, with `cardBasePower` set to the
attacker's `weaponDamage` stat (0 unarmed) instead of a card's `basePower`,
and `cardSchool`/`cardBaseShape` taken from the equipped main_hand weapon
(defaults: physical, cone, width 0.4, range 150 if bare-handed).
This is a
judgment call — `resolveHit` itself doesn't consume `weaponDamage` anywhere
else (card casts still scale off `physicalAttack`/`magicAttack` only, per
`GAME_DESIGN.md`'s stat table), so `weaponDamage` would otherwise be a
dead stat on every weapon in `equipment.json`.

## Starter equipment (vertical slice)

`content/equipment.json` — 6 common/uncommon items seeded via `seedItems`.
No stat budget table exists yet (no gear drops or equip flow live), so these
are first-pass numbers, not budget-derived.
Validated only against the
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
`weaponDamage + physicalAttack + magicAttack` must not exceed 20.
Apprentice
Staff sits exactly at the boundary (6 + 14 = 20, width 1.8) — the validator
enforces `<= 20` (not a strict `<`) specifically so this starter item stays
legal; tightening this to a strict `<` would retroactively break it.
Flagged
here rather than silently choosing one reading, since it's a real judgment
call `item-balancer` may want to revisit once a real stat budget exists.
