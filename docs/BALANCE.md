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
|-----------|-----------:|
| common    | 10         |
| uncommon  | 50         |
| rare      | 200        |
| epic      | 800        |
| legendary | 3,000      |

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

| Constant                  | Value | Meaning |
|---------------------------|------:|---------|
| `LEVEL_SCALING_PER_LEVEL` | 0.05  | Each character level adds 5% of a card's base power. |
| `CRIT_MULTIPLIER`         | 1.5   | Damage multiplier on a crit roll. |
| `MAX_GLANCING_REDUCTION`  | 0.20  | Evasion/parry/magic-resist caps at 20% damage reduction — glancing blow, never full negation. |
| `MIN_DAMAGE`              | 1     | Damage floor after all mitigation. |

Accuracy-vs-avoidance interaction is currently `effectiveAvoidance =
max(0, rawAvoidance - accuracyStat * 0.002)` — the `0.002` conversion rate is
a placeholder, not a tuned value.

## Enemy balance values

`spacetimedb/src/index.ts` — chase-AI tuning constants (module-level,
shared by every enemy) plus current per-enemy seed values:

| Constant             | Value      | Meaning |
|-----------------------|-----------:|---------|
| `AGGRO_RANGE`          | 300px      | Distance at which an idle enemy notices a player. |
| `ATTACK_RANGE`         | 180px      | Distance at which a chasing enemy stops and casts. |
| `DEAGGRO_RANGE`        | 500px      | Distance at which a chasing/cooldown enemy gives up and resets. |
| `CHASE_SPEED`          | 110px/s    | Always slower than the player's 180px/s move speed — a chase is always escapable. |
| `RESET_SPEED`          | 80px/s     | Walk-back-to-spawn speed while resetting. |
| `RESET_HP_PER_TICK`    | 10 HP      | Healed per tick (every 500ms) while resetting. |
| `TICK_SECONDS`         | 0.5s       | `enemyTick` cadence. |

Current seeded enemy stats (`_seedZone1Enemies` / `spawnEnemy`, zone 1):

| Field                    | Value   |
|--------------------------|--------:|
| `currentHp` / `maxHp`    | 100     |
| `damagePerHit`           | 8       |
| `attackRangePx`          | 220px   |
| `attackCooldownSeconds`  | 3.0s    |
| `castDurationSeconds`    | 1.8s    |
| `castShape`              | circle  |
| `castDamage`             | 15      |

All of the above are first-pass placeholder values, not balanced against
real player stats yet.

## Drop rates

`spacetimedb/src/index.ts#_dropCardFromEnemy` — **70% chance** of a ground
card drop per enemy death, uniformly random among cards the killing
character's level qualifies for (`minCharacterLevel <= char.level`). Ground
drops despawn 60s after `createdAt` (swept by `cardDropCleanup`, which runs
every 10s). Pickup requires being within 80px (`pickupCard`).

**Placeholder** — owned by `item-balancer` long-term; not yet tuned against
an economy model.
