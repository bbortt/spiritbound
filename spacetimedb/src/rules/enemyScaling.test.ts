// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import {
  computeEnemyStats,
  type EnemyScaling,
  type RarityMultipliers,
} from './enemyScaling';
import { loadConfig } from '../../../content/configLoader';
import { verifies, SwTraceables } from '../../../src/clew/traceables/clew';

/**
 * The scaling dials are operator dials, so the tests read the shipped config
 * rather than constants that do not exist in the rules module — a retuned
 * config.json is meant to move these numbers, and this suite should move with
 * it rather than pin a second copy of them. The base stats come from the same
 * place for the same reason, so the "seeded enemy" case below stays true to
 * what the module will actually spawn.
 */
const ENEMIES = loadConfig().enemies;
const SCALING: EnemyScaling = {
  castDamageRatio: ENEMIES.castDamageRatio,
  rarityMultipliers: ENEMIES.rarityMultipliers,
};
const MULTIPLIERS: RarityMultipliers = ENEMIES.rarityMultipliers;
const { baseHp: BASE_HP, baseDamage: BASE_DAMAGE } = ENEMIES;

verifies(
  SwTraceables.SW_039_COMPUTE_ENEMY_STATS_SCALES_HP_AND_DAMAGE_BY_LEVEL_AND_RARITY_MULTIPLIER,
  () => {
    describe('computeEnemyStats', () => {
      it('reproduces the seeded zone-1 enemy exactly, from the shipped config', () => {
        // 100 HP / 8 per swing / 15 per cast is what _seedZone1Enemies and
        // spawnEnemy write by hand today. Scaling the config's archetype base
        // to the seeded level has to land on those numbers, or wiring this
        // function into the spawn path would silently retune zone 1.
        expect(
          computeEnemyStats(BASE_HP, BASE_DAMAGE, 2, 'common', SCALING),
        ).toEqual({
          maxHp: 100,
          damagePerHit: 8,
          castDamage: 15,
        });
      });

      it('leaves common untouched at every level, not just the seeded one', () => {
        for (const level of [1, 3, 7, 20]) {
          expect(computeEnemyStats(50, 4, level, 'common', SCALING)).toEqual({
            maxHp: 50 * level,
            damagePerHit: 4 * level,
            castDamage: Math.round(4 * level * SCALING.castDamageRatio),
          });
        }
      });

      it('multiplies both HP and damage by the rarity factor', () => {
        const rare = computeEnemyStats(50, 4, 2, 'rare', SCALING);
        expect(rare.maxHp).toBe(Math.round(100 * MULTIPLIERS.rare.hp));
        expect(rare.damagePerHit).toBe(Math.round(8 * MULTIPLIERS.rare.damage));
      });

      it('scales linearly in level — doubling the level doubles the stats', () => {
        const atTwo = computeEnemyStats(50, 4, 2, 'epic', SCALING);
        const atFour = computeEnemyStats(50, 4, 4, 'epic', SCALING);
        expect(atFour.maxHp).toBe(atTwo.maxHp * 2);
        expect(atFour.damagePerHit).toBe(atTwo.damagePerHit * 2);
      });

      it('keeps the cast above the swing by the ratio, at every rarity', () => {
        for (const rarity of [
          'common',
          'uncommon',
          'rare',
          'epic',
          'legendary',
        ] as const) {
          const stats = computeEnemyStats(50, 4, 3, rarity, SCALING);
          expect(stats.castDamage).toBe(
            Math.round(
              4 * 3 * MULTIPLIERS[rarity].damage * SCALING.castDamageRatio,
            ),
          );
          // The differential is the whole point of the telegraph: a cast that
          // is not worth stepping out of makes the red circle decorative.
          expect(stats.castDamage).toBeGreaterThan(stats.damagePerHit);
        }
      });

      it('makes every higher rarity strictly harder than the one below it', () => {
        const order = ['common', 'uncommon', 'rare', 'epic', 'legendary']
          .map((rarity) =>
            computeEnemyStats(50, 4, 5, rarity as never, SCALING),
          )
          .map((stats) => [stats.maxHp, stats.damagePerHit]);

        for (let i = 1; i < order.length; i++) {
          expect(order[i][0]).toBeGreaterThan(order[i - 1][0]);
          expect(order[i][1]).toBeGreaterThan(order[i - 1][1]);
        }
      });

      it('reads its dials from the parameter, never from the config', () => {
        const flat: RarityMultipliers = {
          common: { hp: 1, damage: 1 },
          uncommon: { hp: 1, damage: 1 },
          rare: { hp: 1, damage: 1 },
          epic: { hp: 1, damage: 1 },
          legendary: { hp: 1, damage: 1 },
        };
        expect(
          computeEnemyStats(50, 4, 2, 'legendary', {
            castDamageRatio: 1,
            rarityMultipliers: flat,
          }),
        ).toEqual({
          maxHp: 100,
          damagePerHit: 8,
          castDamage: 8,
        });
      });
    });
  },
);
