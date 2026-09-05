**Title**
Drop System — level-gated, rarity-weighted ground drops from enemy deaths

**Status**: active

**Business Value**
Per the pillar "every drop has value," ground drops are the primary way
gear and cards re-enter circulation after being lost to permadeath — the
roll/rarity/level-gating math is the whole economy's supply side.
Without
a correctly understood and tested drop pipeline, there is no reliable way
to reason about drop-rate changes or catch a regression before it silently
reshapes the economy.

**Problem / Context**
This is a retrofit story: the drop system (independent card/item rolls,
level-gating, rarity weighting, transient ground objects with scheduled
cleanup) already shipped in a prior session, including a recent rebalance
of the roll chances down from 70%/40% to 25%/20% specifically to make
drops feel earned rather than guaranteed.
No spec currently records this
behavior.
Additionally, the rarity-weighting/level-gating logic
(`_pickWeightedRarity`, `_pickLevelAndRarityGated`) currently lives inline
in `spacetimedb/src/index.ts`, taking `ctx: any` and calling
`ctx.random()`/`ctx.random.integerInRange()` directly — this both violates
the "thin reducers, pure rules functions" architecture rule
(`docs/spec/architecture.md`) and makes the logic untestable as written.

**Solution Approach**
Author SW specs for the roll/eligibility/rarity-pick/despawn-pickup
behaviors and CON specs for the legendary-never-drops rule, the
empty-tier/empty-pool fallback, and the intentional-duplicates rule.
In
the anchoring pass that follows this draft, extract the pure logic into a
new `spacetimedb/src/rules/drops.ts` — `pickWeightedRarity(randomRoll,
weights): Rarity` and `pickLevelAndRarityGated(eligible, randomRoll,
randomIndexRoll): T | null`, taking randomness as parameters (matching
`resolveHit`'s existing pattern) — moving `CARD_DROP_CHANCE`,
`ITEM_DROP_CHANCE`, and the rarity weight table out of `index.ts` as
named exports there.
This is required before these SW specs can be
test-anchored; `spacetimedb/src/rules/drops.test.ts` does not exist yet.

**Acceptance Criteria**

- Every spec below is anchored to the code that already realizes it.
- The rarity/level-gating pick logic is extracted to
  `spacetimedb/src/rules/drops.ts` as pure, randomness-parameterized
  functions, with a `drops.test.ts` covering every SW/CON spec in this
  story.
- `clew coverage` shows every spec in this story as Covered.
- No existing drop-roll behavior changes — this is a documentation-and-test
  retrofit, not a rebalance.

**Out of scope**

- What happens to a picked-up card/item afterward (equipping it) — see the
  Equipment and Hand/Card Management stories.
- The XP grant and enemy-death state transition themselves — see the XP &
  Leveling and Enemy AI stories; this story is only the roll-to-ground-drop
  -to-pickup pipeline.
- A real merge system for duplicate cards/items — not yet built (see
  `CLAUDE.md`'s Next Steps).

## Relations

**Realizes**

- [SYS-004](../specs/SYS-004-enemy-deaths-roll-level-gated-rarity-weighted-ground-drops.md)
- [SW-015](../specs/SW-015-card-and-item-drops-are-independent-per-death-rolls.md)
- [SW-016](../specs/SW-016-drop-eligibility-filters-to-the-killers-level.md)
- [SW-017](../specs/SW-017-a-rarity-tier-is-weight-picked-then-sampled-within-tier.md)
- [SW-018](../specs/SW-018-ground-drops-despawn-in-60s-and-need-80px-to-pick-up.md)
- [CON-004](../specs/CON-004-legendary-drop-weight-is-zero.md)
- [CON-005](../specs/CON-005-empty-rarity-tier-falls-back-to-full-pool-empty-pool-drops-nothing.md)
- [CON-006](../specs/CON-006-duplicate-drops-are-intentional-never-deduplicated.md)
