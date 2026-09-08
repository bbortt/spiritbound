// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import {
  pickWeightedRarity,
  pickLevelAndRarityGated,
  shiftRarityWeightsForMob,
  RARITY_DROP_ORDER,
  type RarityWeights,
} from './drops';
import { loadConfig } from '../../../content/configLoader';
import {
  verifies,
  ConTraceables,
  SwTraceables,
  SysTraceables,
} from '../../../src/clew/traceables/clew';
import type { Rarity } from '../types';

/**
 * The weight table is an operator dial now, so the tests read the
 * shipped config rather than a constant that no longer exists — a retuned
 * config.json is meant to change these boundaries, and this suite should move
 * with it rather than pin the old numbers.
 */
const CARD_WEIGHTS: RarityWeights = loadConfig().dropRates.cards.rarityWeights;

verifies(
  [
    SysTraceables.SYS_004_ENEMY_DEATHS_ROLL_LEVEL_GATED_RARITY_WEIGHTED_GROUND_DROPS,
    ConTraceables.CON_004_LEGENDARY_DROP_WEIGHT_IS_ZERO,
  ] as const,
  () => {
    describe('pickWeightedRarity', () => {
      it('respects the cumulative weight boundaries', () => {
        // common: [0, 0.60), uncommon: [0.60, 0.85), rare: [0.85, 0.97), epic: [0.97, 1.0)
        expect(pickWeightedRarity(0, CARD_WEIGHTS)).toBe('common');
        expect(pickWeightedRarity(0.59, CARD_WEIGHTS)).toBe('common');
        expect(pickWeightedRarity(0.6, CARD_WEIGHTS)).toBe('uncommon');
        expect(pickWeightedRarity(0.84, CARD_WEIGHTS)).toBe('uncommon');
        expect(pickWeightedRarity(0.85, CARD_WEIGHTS)).toBe('rare');
        expect(pickWeightedRarity(0.96, CARD_WEIGHTS)).toBe('rare');
        expect(pickWeightedRarity(0.97, CARD_WEIGHTS)).toBe('epic');
        expect(pickWeightedRarity(0.999, CARD_WEIGHTS)).toBe('epic');
      });

      it('never selects legendary regardless of roll value, since its weight is 0', () => {
        for (const roll of [0, 0.1, 0.5, 0.85, 0.97, 0.999, 0.9999999]) {
          expect(pickWeightedRarity(roll, CARD_WEIGHTS)).not.toBe('legendary');
        }
      });

      it('shifts its boundaries when the operator retunes the weights', () => {
        const rareHeavy: RarityWeights = {
          common: 0.1,
          uncommon: 0.1,
          rare: 0.8,
          epic: 0,
          legendary: 0,
        };
        expect(pickWeightedRarity(0.5, rareHeavy)).toBe('rare');
        expect(pickWeightedRarity(0.5, CARD_WEIGHTS)).toBe('common');
      });

      it('the shipped card weights sum to 1 across every rarity in RARITY_DROP_ORDER', () => {
        const sum = RARITY_DROP_ORDER.reduce(
          (acc, r) => acc + CARD_WEIGHTS[r],
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
        expect(
          pickLevelAndRarityGated<Def>([], 0.5, 0.5, CARD_WEIGHTS),
        ).toBeNull();
      });

      it('falls back to the full eligible pool when the rolled tier has no matching item', () => {
        const eligible: Def[] = [{ id: 1, rarity: 'common' }];
        // Roll a rarity (uncommon) with nothing in that tier — must fall back to common.
        const picked = pickLevelAndRarityGated(eligible, 0.7, 0, CARD_WEIGHTS);
        expect(picked).toEqual({ id: 1, rarity: 'common' });
      });

      it('samples only within the rolled tier when it has eligible items', () => {
        const eligible: Def[] = [
          { id: 1, rarity: 'common' },
          { id: 2, rarity: 'rare' },
        ];
        const picked = pickLevelAndRarityGated(eligible, 0.9, 0, CARD_WEIGHTS); // rolls 'rare'
        expect(picked).toEqual({ id: 2, rarity: 'rare' });
      });
    });
  },
);

/** Every mob rarity that is not the `common` baseline — all get the same shift. */
const NON_COMMON: readonly Rarity[] = [
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;

verifies(
  SwTraceables.SW_040_A_NON_COMMON_MOB_SHIFTS_ITS_DROP_WEIGHTS_TOWARD_HIGHER_RARITY_TIERS,
  () => {
    describe('shiftRarityWeightsForMob', () => {
      it('returns the table untouched for a common mob', () => {
        expect(shiftRarityWeightsForMob(CARD_WEIGHTS, 'common')).toBe(
          CARD_WEIGHTS,
        );
      });

      it('zeroes common and still sums to 1.0 for every non-common mob', () => {
        for (const mobRarity of NON_COMMON) {
          const shifted = shiftRarityWeightsForMob(CARD_WEIGHTS, mobRarity);
          expect(shifted.common).toBe(0);
          const sum = RARITY_DROP_ORDER.reduce((acc, r) => acc + shifted[r], 0);
          expect(sum).toBeCloseTo(1, 10);
        }
      });

      it('keeps the surviving tiers in their original relative proportion', () => {
        const shifted = shiftRarityWeightsForMob(CARD_WEIGHTS, 'rare');
        // 0.25 : 0.12 : 0.03 before, so the same ratios after.
        expect(shifted.uncommon / shifted.rare).toBeCloseTo(
          CARD_WEIGHTS.uncommon / CARD_WEIGHTS.rare,
          10,
        );
        expect(shifted.rare / shifted.epic).toBeCloseTo(
          CARD_WEIGHTS.rare / CARD_WEIGHTS.epic,
          10,
        );
      });

      it('raises every surviving tier — the point of the shift', () => {
        const shifted = shiftRarityWeightsForMob(CARD_WEIGHTS, 'uncommon');
        for (const rarity of ['uncommon', 'rare', 'epic'] as const) {
          expect(shifted[rarity]).toBeGreaterThan(CARD_WEIGHTS[rarity]);
        }
      });

      it('leaves a tier that was already 0 at 0, for every mob rarity', () => {
        for (const mobRarity of NON_COMMON) {
          expect(
            shiftRarityWeightsForMob(CARD_WEIGHTS, mobRarity).legendary,
          ).toBe(0);
        }
      });

      it('does not mutate the table it was handed', () => {
        const before = { ...CARD_WEIGHTS };
        shiftRarityWeightsForMob(CARD_WEIGHTS, 'epic');
        expect(CARD_WEIGHTS).toEqual(before);
      });

      it('returns an all-common table unchanged rather than dividing by zero', () => {
        const allCommon: RarityWeights = {
          common: 1,
          uncommon: 0,
          rare: 0,
          epic: 0,
          legendary: 0,
        };
        expect(shiftRarityWeightsForMob(allCommon, 'epic')).toBe(allCommon);
      });
    });
  },
);

/**
 * The shift is a second code path into the drop roll, so the fixed-at-zero
 * legendary guarantee has to be re-proved through it: the original sweep only
 * ever saw the unshifted table. A shift that handed legendary any weight at all
 * would make a boss kill a legendary source without the constraint that forbids
 * it ever being revisited.
 */
verifies(ConTraceables.CON_004_LEGENDARY_DROP_WEIGHT_IS_ZERO, () => {
  describe('CON-004 — legendary through the mob-rarity shift', () => {
    it('never rolls legendary off a shifted table, at any mob rarity', () => {
      for (const mobRarity of NON_COMMON) {
        const shifted = shiftRarityWeightsForMob(CARD_WEIGHTS, mobRarity);
        for (const roll of [0, 0.1, 0.5, 0.85, 0.97, 0.999, 0.9999999]) {
          expect(pickWeightedRarity(roll, shifted)).not.toBe('legendary');
        }
      }
    });
  });
});
