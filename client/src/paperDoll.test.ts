import { describe, it, expect } from 'vitest';
import { BODY_SLOTS, findEquippedInSlot } from './paperDoll';
import { SwTraceables, verifies } from '../../src/clew/traceables/clew';
import type { EquippedItem } from './db';

function equipped(
  slotTag: string,
  ordinal: number,
  equippedItemId: bigint,
): EquippedItem {
  return {
    equippedItemId,
    characterId: 1n,
    itemInstanceId: equippedItemId,
    slot: { tag: slotTag } as any,
    slotOrdinal: ordinal,
  } as EquippedItem;
}

verifies(
  SwTraceables.SW_005_PAPER_DOLL_GRID_FIXES_EACH_SLOT_TO_ONE_POSITION,
  () => {
    describe('findEquippedInSlot', () => {
      it('finds the right equipped row for every (slot, ordinal) pair the grid defines', () => {
        const rows = BODY_SLOTS.map(([slotTag, ordinal], i) =>
          equipped(slotTag, ordinal, BigInt(i + 1)),
        );
        for (let i = 0; i < BODY_SLOTS.length; i++) {
          const [slotTag, ordinal] = BODY_SLOTS[i];
          const found = findEquippedInSlot(rows, slotTag, ordinal);
          expect(found?.equippedItemId).toBe(BigInt(i + 1));
        }
      });

      it('returns undefined for an empty pairing', () => {
        expect(findEquippedInSlot([], 'MainHand', 0)).toBeUndefined();
        const onlyRing0 = [equipped('Ring', 0, 5n)];
        expect(findEquippedInSlot(onlyRing0, 'Ring', 1)).toBeUndefined();
      });

      it('never confuses a row with a different ordinal or slot tag', () => {
        const rows = [
          equipped('Ring', 0, 1n),
          equipped('Ring', 1, 2n),
          equipped('Earring', 0, 3n),
        ];
        expect(findEquippedInSlot(rows, 'Ring', 0)?.equippedItemId).toBe(1n);
        expect(findEquippedInSlot(rows, 'Ring', 1)?.equippedItemId).toBe(2n);
        expect(findEquippedInSlot(rows, 'Earring', 0)?.equippedItemId).toBe(3n);
        expect(findEquippedInSlot(rows, 'Earring', 1)).toBeUndefined();
      });
    });
  },
);
