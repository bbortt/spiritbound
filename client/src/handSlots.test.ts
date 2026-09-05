import { describe, it, expect } from 'vitest';
import { computeHandSlots, computeAttunementSlots } from './handSlots';
import {
  computeHandSlots as serverComputeHandSlots,
  computeAttunementSlots as serverComputeAttunementSlots,
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
