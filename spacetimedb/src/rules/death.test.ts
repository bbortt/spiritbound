import { describe, it, expect } from 'vitest';
import {
  computeSpiritLevel,
  computeAttunementSlots,
  computeHandSlots,
  computeRetention,
  computeCharacterLevel,
  computeRarityCeiling,
  canSpiritHandle,
  rarityCeilingError,
  type CardForRetention,
} from './death';
import type { Rarity } from '../types';
import {
  verifies,
  ConTraceables,
  SwTraceables,
} from '../../../src/clew/traceables/clew';

verifies(
  SwTraceables.SW_024_SPIRIT_LEVEL_IS_A_LOG_SHAPED_CURVE_OVER_BOND_XP,
  () => {
    describe('computeSpiritLevel', () => {
      it('is clamped to a minimum of 1', () => {
        expect(computeSpiritLevel(0n)).toBe(1);
      });
      it('is clamped to a maximum of 50', () => {
        expect(computeSpiritLevel(1_000_000_000_000n)).toBe(50);
      });
      it('is monotonically non-decreasing as bond XP increases', () => {
        const points = [0n, 10n, 100n, 1_000n, 10_000n, 100_000n, 1_000_000n];
        let prev = 0;
        for (const xp of points) {
          const level = computeSpiritLevel(xp);
          expect(level).toBeGreaterThanOrEqual(prev);
          prev = level;
        }
      });
    });
  },
);

verifies(
  SwTraceables.SW_023_ATTUNEMENT_SLOTS_PER_RARITY_GROW_WITH_SPIRIT_LEVEL_LEGENDARY_GATED_AT_THIRTY,
  () => {
    describe('computeAttunementSlots', () => {
      it('caps each rarity at its stated maximum as spirit level grows', () => {
        const atHighLevel = computeAttunementSlots(1000);
        expect(atHighLevel.common).toBe(8);
        expect(atHighLevel.uncommon).toBe(6);
        expect(atHighLevel.rare).toBe(4);
        expect(atHighLevel.epic).toBe(2);
        expect(atHighLevel.legendary).toBe(1);
      });

      it('legendary is exactly 0 below spirit level 30', () => {
        expect(computeAttunementSlots(1).legendary).toBe(0);
        expect(computeAttunementSlots(29).legendary).toBe(0);
      });

      it('legendary is exactly 1 at and above spirit level 30, never more', () => {
        expect(computeAttunementSlots(30).legendary).toBe(1);
        expect(computeAttunementSlots(50).legendary).toBe(1);
      });

      it('common starts at 1 slot at level 1', () => {
        expect(computeAttunementSlots(1).common).toBe(1);
      });
    });
  },
);

verifies(
  SwTraceables.SW_027_HAND_SLOT_CAPS_GROW_WITH_SPIRIT_LEVEL_INDEPENDENTLY_FOR_ACTIVE_AND_PASSIVE,
  () => {
    describe('computeHandSlots', () => {
      it('starts at 2 active / 1 passive at spirit level 1', () => {
        expect(computeHandSlots(1)).toEqual({ active: 2, passive: 1 });
      });

      it('caps at 10 active / 5 passive at high spirit level', () => {
        expect(computeHandSlots(1000)).toEqual({ active: 10, passive: 5 });
      });

      it('active and passive scale independently of one another', () => {
        const low = computeHandSlots(5);
        const high = computeHandSlots(25);
        expect(high.active).toBeGreaterThan(low.active);
        expect(high.passive).toBeGreaterThanOrEqual(low.passive);
      });
    });
  },
);

verifies(
  SwTraceables.SW_022_ONLY_ATTUNED_CARDS_SURVIVE_CONSUMING_A_RARITY_SLOT_EACH,
  () => {
    describe('computeRetention', () => {
      function card(
        id: bigint,
        rarity: CardForRetention['rarity'],
        attuned: boolean,
      ): CardForRetention {
        return { cardInstanceId: id, rarity, attuned };
      }

      it('un-attuned cards are always lost, regardless of rarity or slot availability', () => {
        const { lost, surviving } = computeRetention(
          [card(1n, 'common', false)],
          { common: 10, uncommon: 10, rare: 10, epic: 10, legendary: 10 },
        );
        expect(lost.has(1n)).toBe(true);
        expect(surviving.has(1n)).toBe(false);
      });

      it('attuned cards survive up to the rarity slot budget, excess is lost as a fail-safe', () => {
        const cards = [
          card(1n, 'common', true),
          card(2n, 'common', true),
          card(3n, 'common', true),
        ];
        const { surviving, lost } = computeRetention(cards, {
          common: 2,
          uncommon: 0,
          rare: 0,
          epic: 0,
          legendary: 0,
        });
        expect(surviving.size).toBe(2);
        expect(lost.size).toBe(1);
      });

      it('each rarity consumes only its own slot budget', () => {
        const cards = [card(1n, 'common', true), card(2n, 'rare', true)];
        const { surviving } = computeRetention(cards, {
          common: 1,
          uncommon: 0,
          rare: 1,
          epic: 0,
          legendary: 0,
        });
        expect(surviving.has(1n)).toBe(true);
        expect(surviving.has(2n)).toBe(true);
      });
    });
  },
);

verifies(
  SwTraceables.SW_021_CHARACTER_LEVEL_IS_A_FIXED_POWER_CURVE_OVER_XP_CLAMPED_ONE_TO_FIFTY,
  () => {
    describe('computeCharacterLevel', () => {
      it('is level 1 at zero XP', () => {
        expect(computeCharacterLevel(0n)).toBe(1);
      });

      it('never exceeds level 50 even at extreme XP', () => {
        expect(computeCharacterLevel(1_000_000_000n)).toBe(50);
      });

      it('is monotonically non-decreasing as XP increases', () => {
        const points = [0n, 10n, 100n, 1_000n, 10_000n, 100_000n, 1_000_000n];
        let prev = 0;
        for (const xp of points) {
          const level = computeCharacterLevel(xp);
          expect(level).toBeGreaterThanOrEqual(prev);
          prev = level;
        }
      });
    });
  },
);

verifies(
  SwTraceables.SW_033_THE_RARITY_CEILING_STEPS_AT_SPIRIT_LEVELS_FIVE_TWELVE_TWENTY_FIVE_AND_FORTY,
  () => {
    describe('computeRarityCeiling', () => {
      it('is common below spirit level 5', () => {
        expect(computeRarityCeiling(1)).toBe('common');
        expect(computeRarityCeiling(4)).toBe('common');
      });

      it('steps up exactly at 5, 12, 25 and 40', () => {
        expect(computeRarityCeiling(5)).toBe('uncommon');
        expect(computeRarityCeiling(11)).toBe('uncommon');
        expect(computeRarityCeiling(12)).toBe('rare');
        expect(computeRarityCeiling(24)).toBe('rare');
        expect(computeRarityCeiling(25)).toBe('epic');
        expect(computeRarityCeiling(39)).toBe('epic');
        expect(computeRarityCeiling(40)).toBe('legendary');
        expect(computeRarityCeiling(50)).toBe('legendary');
      });
    });

    describe('canSpiritHandle', () => {
      it('accepts a card exactly at the ceiling', () => {
        expect(canSpiritHandle(5, 'uncommon')).toBe(true);
        expect(canSpiritHandle(12, 'rare')).toBe(true);
        expect(canSpiritHandle(40, 'legendary')).toBe(true);
      });

      it('accepts every rarity below the ceiling', () => {
        expect(canSpiritHandle(25, 'common')).toBe(true);
        expect(canSpiritHandle(25, 'uncommon')).toBe(true);
        expect(canSpiritHandle(25, 'rare')).toBe(true);
      });

      it('rejects the tier immediately above the ceiling', () => {
        expect(canSpiritHandle(4, 'uncommon')).toBe(false);
        expect(canSpiritHandle(11, 'rare')).toBe(false);
        expect(canSpiritHandle(24, 'epic')).toBe(false);
        expect(canSpiritHandle(39, 'legendary')).toBe(false);
      });

      it('lets a level-1 spirit hold only commons', () => {
        const above: Rarity[] = ['uncommon', 'rare', 'epic', 'legendary'];
        expect(canSpiritHandle(1, 'common')).toBe(true);
        for (const rarity of above) {
          expect(canSpiritHandle(1, rarity)).toBe(false);
        }
      });
    });
  },
);

verifies(
  SwTraceables.SW_034_EQUIPPING_OR_ATTUNING_ABOVE_THE_CEILING_IS_REJECTED_NAMING_THE_CEILING,
  () => {
    describe('rarityCeilingError', () => {
      it('names the spirit level, the refused rarity and the ceiling', () => {
        const message = rarityCeilingError(8, 'rare');
        expect(message).toContain('Lv 8');
        expect(message).toContain('rare');
        expect(message).toContain('up to uncommon');
      });
    });
  },
);

verifies(
  ConTraceables.CON_017_THE_RARITY_CEILING_AND_THE_ATTUNEMENT_SLOTS_ARE_TWO_SEPARATE_GATES,
  () => {
    describe('CON-017 — the ceiling and the attunement budget are independent', () => {
      it('can hold a rarity it has no attunement slot for', () => {
        // Spirit 12 reaches the rare ceiling but has only floor(12*0.08)=0 epic
        // slots and no legendary slot: wieldable is not the same as protectable.
        expect(canSpiritHandle(12, 'rare')).toBe(true);
        expect(computeAttunementSlots(12).epic).toBe(0);
        expect(computeAttunementSlots(12).legendary).toBe(0);
      });

      it('has an attunement slot for a rarity below its ceiling too', () => {
        // The gates move at different rates; neither derives from the other.
        expect(computeAttunementSlots(30).legendary).toBe(1);
        expect(canSpiritHandle(30, 'legendary')).toBe(false);
      });
    });
  },
);
