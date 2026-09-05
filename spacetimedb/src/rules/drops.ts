/**
 * rules/drops.ts — ground-drop rarity weighting and level-gating.
 * Pure functions: no SpacetimeDB imports, no side effects. Randomness is always
 * taken as a parameter (a 0..1 roll) so callers (reducers) can pass `ctx.random()`
 * and tests can pass a fixed value.
 */

import type { Rarity } from '../types';
import {
  realizes,
  concerns,
  ConTraceables,
  SwTraceables,
  SysTraceables,
} from '../../../src/clew/traceables/clew';

/** Chance of a ground card drop per enemy death. */
export const CARD_DROP_CHANCE = 0.25;
/** Chance of a ground item drop per enemy death — independent of the card roll. */
export const ITEM_DROP_CHANCE = 0.2;

/**
 * Rarity weights for both card and item drop rolls. Legendary is 0 — trash
 * mobs never drop legendaries, reserved for bosses/dungeon tiers (BALANCE.md).
 */
export const RARITY_DROP_WEIGHTS: Record<Rarity, number> = concerns(
  ConTraceables.CON_004_LEGENDARY_DROP_WEIGHT_IS_ZERO,
  { common: 0.6, uncommon: 0.25, rare: 0.12, epic: 0.03, legendary: 0 },
);
export const RARITY_DROP_ORDER: readonly Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;

/**
 * Roll a rarity tier weighted by RARITY_DROP_WEIGHTS (common-heavy, legendary
 * never rolls since its weight is 0 — trash mobs don't drop legendaries).
 */
export const pickWeightedRarity = realizes(
  [
    SysTraceables.SYS_004_ENEMY_DEATHS_ROLL_LEVEL_GATED_RARITY_WEIGHTED_GROUND_DROPS,
    ConTraceables.CON_004_LEGENDARY_DROP_WEIGHT_IS_ZERO,
  ] as const,
  function pickWeightedRarity(randomRoll: number): Rarity {
    let cumulative = 0;
    for (const rarity of RARITY_DROP_ORDER) {
      cumulative += RARITY_DROP_WEIGHTS[rarity];
      if (randomRoll < cumulative) return rarity;
    }
    return 'common'; // fallback for float rounding at the top of the range
  },
);

/**
 * Pick one item from `eligible` (already level-filtered), preferring one that
 * matches the rolled rarity tier; falls back to any eligible item if that tier
 * is empty at this level (e.g. no epics unlocked yet), and to null if `eligible`
 * itself is empty — never errors, just signals "drop nothing."
 */
export const pickLevelAndRarityGated = realizes(
  [
    SwTraceables.SW_017_A_RARITY_TIER_IS_WEIGHT_PICKED_THEN_SAMPLED_WITHIN_TIER,
    ConTraceables.CON_005_EMPTY_RARITY_TIER_FALLS_BACK_TO_FULL_POOL_EMPTY_POOL_DROPS_NOTHING,
  ] as const,
  function pickLevelAndRarityGated<T extends { rarity: Rarity }>(
    eligible: readonly T[],
    randomRarityRoll: number,
    randomIndexRoll: number,
  ): T | null {
    if (eligible.length === 0) return null;
    const rarity = pickWeightedRarity(randomRarityRoll);
    const pool = eligible.filter((item) => item.rarity === rarity);
    const finalPool = pool.length > 0 ? pool : eligible;
    const index = Math.min(
      finalPool.length - 1,
      Math.floor(randomIndexRoll * finalPool.length),
    );
    return finalPool[index];
  },
);
