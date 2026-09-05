import { describe, it, expect } from 'vitest';
import {
  pickWeightedRarity,
  pickLevelAndRarityGated,
  RARITY_DROP_WEIGHTS,
  RARITY_DROP_ORDER,
} from './drops';
import {
  verifies,
  ConTraceables,
  SwTraceables,
  SysTraceables,
} from '../../../src/clew/traceables/clew';
import type { Rarity } from '../types';

verifies(
  [
    SysTraceables.SYS_004_ENEMY_DEATHS_ROLL_LEVEL_GATED_RARITY_WEIGHTED_GROUND_DROPS,
    ConTraceables.CON_004_LEGENDARY_DROP_WEIGHT_IS_ZERO,
  ] as const,
  () => {
    describe('pickWeightedRarity', () => {
      it('respects the cumulative weight boundaries', () => {
        // common: [0, 0.60), uncommon: [0.60, 0.85), rare: [0.85, 0.97), epic: [0.97, 1.0)
        expect(pickWeightedRarity(0)).toBe('common');
        expect(pickWeightedRarity(0.59)).toBe('common');
        expect(pickWeightedRarity(0.6)).toBe('uncommon');
        expect(pickWeightedRarity(0.84)).toBe('uncommon');
        expect(pickWeightedRarity(0.85)).toBe('rare');
        expect(pickWeightedRarity(0.96)).toBe('rare');
        expect(pickWeightedRarity(0.97)).toBe('epic');
        expect(pickWeightedRarity(0.999)).toBe('epic');
      });

      it('never selects legendary regardless of roll value, since its weight is 0', () => {
        for (const roll of [0, 0.1, 0.5, 0.85, 0.97, 0.999, 0.9999999]) {
          expect(pickWeightedRarity(roll)).not.toBe('legendary');
        }
      });

      it('RARITY_DROP_WEIGHTS sums to 1 across every rarity in RARITY_DROP_ORDER', () => {
        const sum = RARITY_DROP_ORDER.reduce(
          (acc, r) => acc + RARITY_DROP_WEIGHTS[r],
          0,
        );
        expect(sum).toBeCloseTo(1, 5);
      });
    });
  },
);

verifies(
  [
    SwTraceables.SW_017_A_RARITY_TIER_IS_WEIGHT_PICKED_THEN_SAMPLED_WITHIN_TIER,
    ConTraceables.CON_005_EMPTY_RARITY_TIER_FALLS_BACK_TO_FULL_POOL_EMPTY_POOL_DROPS_NOTHING,
  ] as const,
  () => {
    describe('pickLevelAndRarityGated', () => {
      interface Def {
        id: number;
        rarity: Rarity;
      }

      it('returns null when the eligible pool is empty, never throws', () => {
        expect(pickLevelAndRarityGated<Def>([], 0.5, 0.5)).toBeNull();
      });

      it('falls back to the full eligible pool when the rolled tier has no matching item', () => {
        const eligible: Def[] = [{ id: 1, rarity: 'common' }];
        // Roll a rarity (uncommon) with nothing in that tier — must fall back to common.
        const picked = pickLevelAndRarityGated(eligible, 0.7, 0);
        expect(picked).toEqual({ id: 1, rarity: 'common' });
      });

      it('samples only within the rolled tier when it has eligible items', () => {
        const eligible: Def[] = [
          { id: 1, rarity: 'common' },
          { id: 2, rarity: 'rare' },
        ];
        const picked = pickLevelAndRarityGated(eligible, 0.9, 0); // rolls 'rare'
        expect(picked).toEqual({ id: 2, rarity: 'rare' });
      });
    });
  },
);
