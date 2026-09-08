// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import { computeEnemyStats, type RarityMultipliers } from './enemyScaling';
import { loadConfig } from '../../../content/configLoader';
import { verifies, SwTraceables } from '../../../src/clew/traceables/clew';

/**
 * The multiplier table is an operator dial, so the tests read the shipped
 * config rather than a constant that does not exist in the rules module — a
 * retuned config.json is meant to move these numbers, and this suite should
 * move with it rather than pin a second copy of them.
 */
const MULTIPLIERS: RarityMultipliers = loadConfig().enemies.rarityMultipliers;

verifies(
  SwTraceables.SW_039_COMPUTE_ENEMY_STATS_SCALES_HP_AND_DAMAGE_BY_LEVEL_AND_RARITY_MULTIPLIER,
  () => {
    describe('computeEnemyStats', () => {
      it('returns exactly the level-scaled base for a common enemy', () => {
        expect(computeEnemyStats(50, 4, 2, 'common', MULTIPLIERS)).toEqual({
          maxHp: 100,
          damagePerHit: 8,
          castDamage: 8,
        });
      });

      it('leaves common untouched at every level, not just the seeded one', () => {
        for (const level of [1, 3, 7, 20]) {
          expect(
            computeEnemyStats(50, 4, level, 'common', MULTIPLIERS),
          ).toEqual({
            maxHp: 50 * level,
            damagePerHit: 4 * level,
            castDamage: 4 * level,
          });
        }
      });

      it('multiplies both HP and damage by the rarity factor', () => {
        const rare = computeEnemyStats(50, 4, 2, 'rare', MULTIPLIERS);
        expect(rare.maxHp).toBe(Math.round(100 * MULTIPLIERS.rare.hp));
        expect(rare.damagePerHit).toBe(Math.round(8 * MULTIPLIERS.rare.damage));
      });

      it('scales linearly in level — doubling the level doubles the stats', () => {
        const atTwo = computeEnemyStats(50, 4, 2, 'epic', MULTIPLIERS);
        const atFour = computeEnemyStats(50, 4, 4, 'epic', MULTIPLIERS);
        expect(atFour.maxHp).toBe(atTwo.maxHp * 2);
        expect(atFour.damagePerHit).toBe(atTwo.damagePerHit * 2);
      });

      it('tracks castDamage to damagePerHit across every rarity', () => {
        for (const rarity of [
          'common',
          'uncommon',
          'rare',
          'epic',
          'legendary',
        ] as const) {
          const stats = computeEnemyStats(50, 4, 3, rarity, MULTIPLIERS);
          expect(stats.castDamage).toBe(stats.damagePerHit);
        }
      });

      it('makes every higher rarity strictly harder than the one below it', () => {
        const order = ['common', 'uncommon', 'rare', 'epic', 'legendary']
          .map((rarity) =>
            computeEnemyStats(50, 4, 5, rarity as never, MULTIPLIERS),
          )
          .map((stats) => [stats.maxHp, stats.damagePerHit]);

        for (let i = 1; i < order.length; i++) {
          expect(order[i][0]).toBeGreaterThan(order[i - 1][0]);
          expect(order[i][1]).toBeGreaterThan(order[i - 1][1]);
        }
      });

      it('reads the multipliers from its parameter, never from the config', () => {
        const flat: RarityMultipliers = {
          common: { hp: 1, damage: 1 },
          uncommon: { hp: 1, damage: 1 },
          rare: { hp: 1, damage: 1 },
          epic: { hp: 1, damage: 1 },
          legendary: { hp: 1, damage: 1 },
        };
        expect(computeEnemyStats(50, 4, 2, 'legendary', flat)).toEqual({
          maxHp: 100,
          damagePerHit: 8,
          castDamage: 8,
        });
      });
    });
  },
);
