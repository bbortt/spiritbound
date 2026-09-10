// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * rules/enemyScaling.ts — enemy combat stats from a base, a level and a rarity.
 * Pure functions: no SpacetimeDB imports, no side effects. The dials come in as
 * a parameter (content/config.json's `enemies` block, threaded in by the reducer
 * module) rather than being read or hardcoded here, so the rules stay
 * independent of the operator's config file and a test can fix the numbers. The
 * archetype's `baseHp`/`baseDamage` live in that same block today and arrive as
 * the first two arguments; they move to a per-enemy definition once one exists.
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

/**
 * The scaling dials this module reads — the `enemies` block of the server
 * config satisfies this structurally. It arrives as one parameter rather than
 * one per dial so adding a dial never changes the function's arity, and so a
 * caller cannot pass a multiplier table that belongs to a different config.
 */
export interface EnemyScaling {
  castDamageRatio: number;
  rarityMultipliers: RarityMultipliers;
}

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
 * `castDamage` takes the same base and the same two factors, then one more:
 * `castDamageRatio`. The cast is the enemy's *telegraphed* attack — it draws a
 * shape on the ground and gives the player its whole duration to leave — so it
 * has to hit harder than an ordinary swing or there is nothing to dodge. The
 * differential is a single operator dial — the config schema bounds it at or
 * above 1.0, so a cast that lands softer than a swing is unrepresentable —
 * rather than a second authored damage number, so it survives a retune of the
 * base and cannot drift per rarity.
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
      scaling: EnemyScaling,
    ): EnemyStats {
      const multiplier = scaling.rarityMultipliers[rarity];
      const damage = baseDamage * level * multiplier.damage;
      return {
        maxHp: Math.round(baseHp * level * multiplier.hp),
        damagePerHit: Math.round(damage),
        // Rounded from the same unrounded product rather than from
        // `damagePerHit`, so the ratio is applied once and a small base does
        // not compound two roundings into a visibly wrong differential.
        castDamage: Math.round(damage * scaling.castDamageRatio),
      };
    },
  ),
);
