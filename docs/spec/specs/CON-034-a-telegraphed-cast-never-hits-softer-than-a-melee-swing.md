**Title**
A telegraphed cast never hits softer than a melee swing

**Lens**: CON

**Status**: active

**Description**
`content/config.json`'s `enemies.castDamageRatio` must be `>= 1.0`.
A config below that bound is rejected at validation, so a deployment in
which an enemy's telegraphed cast lands for less than its ordinary swing
is unrepresentable rather than merely discouraged.

**Rationale**
The cast is the enemy's telegraphed attack: it announces itself, draws a
shape on the ground, and gives the player the whole cast duration to step
out of it.
That trade only works if standing in it costs more than
trading swings — a ratio below 1.0 inverts the mechanic, making the
correct play "ignore the red circle", and a ratio of exactly 1.0 already
makes dodging pointless in damage terms even though it stays coherent.
The bound is therefore on the ratio itself rather than on the two damage
numbers, because the ratio is what the telegraph mechanic actually
depends on, and it survives any retune of `enemies.baseDamage`.

**Verification Description**
`content/config.test.ts` asserts the shipped ratio (1.875, the value that
reproduces the seeded 15-vs-8 differential) validates and is at or above
1.0, and that a mutation setting it below 1.0 — including a plausible
operator typo such as 0.9 — is rejected by `validateConfig`.

## Relations

**Realizes**

- [SYS-012](SYS-012-enemy-difficulty-scales-with-rarity-as-well-as-level.md)

**Related**

- [SW-039](SW-039-compute-enemy-stats-scales-hp-and-damage-by-level-and-rarity-multiplier.md) — the scaling function that reads this dial to derive `castDamage`
- [CON-026](CON-026-rarity-multipliers-cover-every-rarity-at-or-above-one-increasing-by-tier.md) — the sibling bound on the other operator-editable enemy scaling table

## Changes

- **2026-09-10** — Promoted active alongside the `enemies.castDamageRatio`
  config key it constrains.
  The dial was introduced because `computeEnemyStats` had collapsed
  `castDamage` into `damagePerHit`, silently discarding the 1.875x
  differential the seeded enemy ships with; a dial that can be set below
  1.0 would let an operator reintroduce the same defect deliberately, so
  the bound lands with the dial rather than after it.
