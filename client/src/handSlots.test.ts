import { describe, it, expect } from 'vitest';
import {
  computeHandSlots,
  computeAttunementSlots,
  computeRarityCeiling,
  canSpiritHandle,
  spiritCeilingHeadline,
  RARITY_ORDER,
} from './handSlots';
import {
  computeHandSlots as serverComputeHandSlots,
  computeAttunementSlots as serverComputeAttunementSlots,
  computeRarityCeiling as serverComputeRarityCeiling,
  canSpiritHandle as serverCanSpiritHandle,
} from '../../spacetimedb/src/rules/death';
import {
  verifies,
  SwTraceables,
  ArchTraceables,
} from '../../src/clew/traceables/clew';

verifies(
  [
    SwTraceables.SW_027_HAND_SLOT_CAPS_GROW_WITH_SPIRIT_LEVEL_INDEPENDENTLY_FOR_ACTIVE_AND_PASSIVE,
    ArchTraceables.ARCH_008_COLLECTION_PANELS_CLIENT_DUPLICATE_IS_CORRECTED_TO_MATCH_RULES_DEATH_EXACTLY,
  ] as const,
  () => {
    describe('client computeHandSlots matches the server exactly', () => {
      it('agrees with rules/death.ts#computeHandSlots across a swept range of spirit levels', () => {
        for (let level = 1; level <= 60; level++) {
          expect(computeHandSlots(level)).toEqual(
            serverComputeHandSlots(level),
          );
        }
      });
    });

    describe('client computeAttunementSlots matches the server exactly', () => {
      it('agrees with rules/death.ts#computeAttunementSlots across a swept range of spirit levels', () => {
        for (let level = 1; level <= 60; level++) {
          expect(computeAttunementSlots(level)).toEqual(
            serverComputeAttunementSlots(level),
          );
        }
      });

      it('returns a real per-rarity breakdown, not the old single combined number', () => {
        const slots = computeAttunementSlots(30);
        expect(slots).toHaveProperty('common');
        expect(slots).toHaveProperty('uncommon');
        expect(slots).toHaveProperty('rare');
        expect(slots).toHaveProperty('epic');
        expect(slots).toHaveProperty('legendary');
        expect(slots.legendary).toBe(1); // unlocked at spirit level 30
      });
    });
  },
);

verifies(
  [
    SwTraceables.SW_033_THE_RARITY_CEILING_STEPS_AT_SPIRIT_LEVELS_FIVE_TWELVE_TWENTY_FIVE_AND_FORTY,
    ArchTraceables.ARCH_008_COLLECTION_PANELS_CLIENT_DUPLICATE_IS_CORRECTED_TO_MATCH_RULES_DEATH_EXACTLY,
  ] as const,
  () => {
    describe('client rarity ceiling matches the server exactly', () => {
      it('agrees with rules/death.ts#computeRarityCeiling across a swept range', () => {
        for (let level = 1; level <= 60; level++) {
          expect(computeRarityCeiling(level)).toBe(
            serverComputeRarityCeiling(level),
          );
        }
      });

      it('agrees with rules/death.ts#canSpiritHandle for every level and rarity', () => {
        for (let level = 1; level <= 60; level++) {
          for (const rarity of RARITY_ORDER) {
            expect(canSpiritHandle(level, rarity)).toBe(
              serverCanSpiritHandle(level, rarity),
            );
          }
        }
      });
    });
  },
);

verifies(
  SwTraceables.SW_035_CARDS_ABOVE_THE_CEILING_RENDER_LOCKED_AND_THE_HEADER_NAMES_THE_CEILING,
  () => {
    describe('spiritCeilingHeadline', () => {
      it('names the level and the ceiling in words', () => {
        expect(spiritCeilingHeadline(8)).toBe(
          'Spirit Lv 8 — can handle up to Uncommon cards',
        );
        expect(spiritCeilingHeadline(1)).toBe(
          'Spirit Lv 1 — can handle up to Common cards',
        );
        expect(spiritCeilingHeadline(40)).toBe(
          'Spirit Lv 40 — can handle up to Legendary cards',
        );
      });
    });
  },
);
