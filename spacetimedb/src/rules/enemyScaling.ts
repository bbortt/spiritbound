// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * rules/enemyScaling.ts — enemy combat stats from a base, a level and a rarity.
 * Pure functions: no SpacetimeDB imports, no side effects. The multiplier table
 * comes in as a parameter (from content/config.json's enemies.rarityMultipliers
 * via the reducer module) rather than being read or hardcoded here, so the rules
 * stay independent of the operator's config file and a test can fix the numbers.
 */

import type { Rarity } from '../types';
import {
  realizes,
  concerns,
  SwTraceables,
  SysTraceables,
} from '../../../src/clew/traceables/clew';

/** The `{hp, damage}` pair one rarity multiplies an enemy's base stats by. */
export interface RarityMultiplier {
  hp: number;
  damage: number;
}

/** The `enemies.rarityMultipliers` block of the server config. */
export type RarityMultipliers = Record<Rarity, RarityMultiplier>;

/** What an enemy row's three combat-stat columns are set to on spawn. */
export interface EnemyStats {
  maxHp: number;
  damagePerHit: number;
  castDamage: number;
}

/**
 * Scale an enemy's base HP and damage by its level, then by its rarity.
 *
 * Level scaling is linear — a level-2 enemy is twice the base, a level-4 one
 * four times — so the zone's level band alone already separates a low-band mob
 * from a high-band one. Rarity is the second, independent axis on top of that:
 * a common enemy multiplies by 1.0/1.0 and so returns exactly the level-scaled
 * base, while the higher tiers pull HP far harder than damage (40x vs 3.2x at
 * legendary in the shipped table) — a rare spawn should take much longer to
 * kill without one-shotting the player who found it.
 *
 * `castDamage` scales identically to `damagePerHit`: a telegraphed cast is just
 * another damage source from the same enemy, so it takes the same base and the
 * same factors.
 */
export const computeEnemyStats = concerns(
  SysTraceables.SYS_012_ENEMY_DIFFICULTY_SCALES_WITH_RARITY_AS_WELL_AS_LEVEL,
  realizes(
    SwTraceables.SW_039_COMPUTE_ENEMY_STATS_SCALES_HP_AND_DAMAGE_BY_LEVEL_AND_RARITY_MULTIPLIER,
    function computeEnemyStats(
      baseHp: number,
      baseDamage: number,
      level: number,
      rarity: Rarity,
      multipliers: RarityMultipliers,
    ): EnemyStats {
      const multiplier = multipliers[rarity];
      const scaledDamage = Math.round(baseDamage * level * multiplier.damage);
      return {
        maxHp: Math.round(baseHp * level * multiplier.hp),
        damagePerHit: scaledDamage,
        castDamage: scaledDamage,
      };
    },
  ),
);
