// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * rules/drops.ts — ground-drop rarity weighting and level-gating.
 * Pure functions: no SpacetimeDB imports, no side effects. Randomness is always
 * taken as a parameter (a 0..1 roll) so callers (reducers) can pass `ctx.random()`
 * and tests can pass a fixed value.
 *
 * The drop chances and the rarity weight table are no longer constants here:
 * they are server-operator dials in content/config.json, passed in by the
 * reducer module so this file stays independent of the config.
 */

import type { Rarity } from '../types';
import {
  realizes,
  concerns,
  ConTraceables,
  SwTraceables,
  SysTraceables,
} from '../../../src/clew/traceables/clew';

/** A rarity weight table, as declared per drop category in config.json. */
export type RarityWeights = Record<Rarity, number>;

export const RARITY_DROP_ORDER: readonly Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;

/**
 * Roll a rarity tier weighted by the supplied table (common-heavy in the
 * shipped config; legendary never rolls there, since its weight is 0 — trash
 * mobs don't drop legendaries). The table is validated to sum to 1.0 at module
 * load, so the trailing fallback only catches float rounding at the
 * very top of the range.
 */
export const pickWeightedRarity = realizes(
  [
    SysTraceables.SYS_004_ENEMY_DEATHS_ROLL_LEVEL_GATED_RARITY_WEIGHTED_GROUND_DROPS,
    ConTraceables.CON_004_LEGENDARY_DROP_WEIGHT_IS_ZERO,
  ] as const,
  function pickWeightedRarity(
    randomRoll: number,
    weights: RarityWeights,
  ): Rarity {
    let cumulative = 0;
    for (const rarity of RARITY_DROP_ORDER) {
      cumulative += weights[rarity];
      if (randomRoll < cumulative) return rarity;
    }
    return 'common'; // fallback for float rounding at the top of the range
  },
);

/**
 * Raise the floor of a mob's drop table by its own rarity.
 *
 * A common mob is the baseline and gets its table back untouched. Any
 * non-common mob drops the `common` tier entirely: that weight is redistributed
 * across the other four tiers in proportion to the relative weight they already
 * had, so a better mob is correspondingly likelier to drop something better
 * without the shift ever inventing weight for a tier the base table
 * deliberately excludes. Legendary ships at 0, and a zero share of any
 * redistributed mass is still zero, so the fixed-at-zero legendary weight holds
 * even for a boss kill — unlocking legendary drops is a decision its own
 * constraint has to revisit, not something this shift should do behind its back.
 *
 * The output sums to whatever the input summed to, which the config schema pins
 * at 1.0. A table that is 100% common has no relative weight to redistribute
 * into; rather than divide by zero and hand `pickWeightedRarity` a table of
 * NaNs, that degenerate case returns the input unchanged and the roll's own
 * empty-tier fallback takes it from there.
 */
export const shiftRarityWeightsForMob = realizes(
  SwTraceables.SW_040_A_NON_COMMON_MOB_SHIFTS_ITS_DROP_WEIGHTS_TOWARD_HIGHER_RARITY_TIERS,
  concerns(
    ConTraceables.CON_004_LEGENDARY_DROP_WEIGHT_IS_ZERO,
    function shiftRarityWeightsForMob(
      weights: RarityWeights,
      mobRarity: Rarity,
    ): RarityWeights {
      if (mobRarity === 'common') return weights;

      const above = RARITY_DROP_ORDER.filter((rarity) => rarity !== 'common');
      const aboveTotal = above.reduce(
        (total, rarity) => total + weights[rarity],
        0,
      );
      if (aboveTotal <= 0) return weights;

      const shifted = { ...weights, common: 0 };
      for (const rarity of above) {
        shifted[rarity] =
          weights[rarity] + weights.common * (weights[rarity] / aboveTotal);
      }
      return shifted;
    },
  ),
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
    weights: RarityWeights,
  ): T | null {
    if (eligible.length === 0) return null;
    const rarity = pickWeightedRarity(randomRarityRoll, weights);
    const pool = eligible.filter((item) => item.rarity === rarity);
    const finalPool = pool.length > 0 ? pool : eligible;
    const index = Math.min(
      finalPool.length - 1,
      Math.floor(randomIndexRoll * finalPool.length),
    );
    return finalPool[index];
  },
);
