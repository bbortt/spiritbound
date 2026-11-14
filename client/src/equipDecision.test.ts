// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import { decideEquipAction } from './equipDecision';
import { SwTraceables, verifies } from '../../src/clew/traceables/clew';
import type { EquippedItem } from './db';

function equipped(
  slotTag: string,
  ordinal: number,
  itemInstanceId: bigint,
): EquippedItem {
  return {
    equippedItemId: itemInstanceId,
    characterId: 1n,
    itemInstanceId,
    slot: { tag: slotTag } as any,
    slotOrdinal: ordinal,
  } as EquippedItem;
}

verifies(
  SwTraceables.SW_006_INVENTORY_CLICK_PICKS_FIRST_EMPTY_DUAL_SLOT_ORDINAL,
  () => {
    describe('decideEquipAction', () => {
      it('equips a dual-slot type into ordinal 0 when both are empty', () => {
        const d = decideEquipAction(99n, 'Ring', true, [], 10, 1);
        expect(d).toEqual({ kind: 'equip', slot: 'Ring', slotOrdinal: 0 });
      });

      it('equips a dual-slot type into ordinal 1 when only ordinal 0 is occupied', () => {
        const d = decideEquipAction(
          99n,
          'Ring',
          true,
          [equipped('Ring', 0, 1n)],
          10,
          1,
        );
        expect(d).toEqual({ kind: 'equip', slot: 'Ring', slotOrdinal: 1 });
      });

      it('decides to replace ordinal 0 when both dual-slot ordinals are occupied', () => {
        const occ0 = equipped('Ring', 0, 1n);
        const d = decideEquipAction(
          99n,
          'Ring',
          true,
          [occ0, equipped('Ring', 1, 2n)],
          10,
          1,
        );
        expect(d.kind).toBe('replace');
        if (d.kind === 'replace') {
          expect(d.occupant).toBe(occ0);
          expect(d.slotOrdinal).toBe(0);
        }
      });

      it('equips a single slot into ordinal 0 when empty', () => {
        const d = decideEquipAction(99n, 'MainHand', false, [], 10, 1);
        expect(d).toEqual({ kind: 'equip', slot: 'MainHand', slotOrdinal: 0 });
      });

      it('decides to replace a single slot when occupied', () => {
        const occ = equipped('MainHand', 0, 1n);
        const d = decideEquipAction(99n, 'MainHand', false, [occ], 10, 1);
        expect(d.kind).toBe('replace');
        if (d.kind === 'replace') {
          expect(d.occupant).toBe(occ);
        }
      });

      it('decides to unequip when the clicked instance is already equipped, regardless of slot type', () => {
        const d = decideEquipAction(
          5n,
          'Ring',
          true,
          [equipped('Ring', 0, 5n)],
          10,
          1,
        );
        expect(d).toEqual({ kind: 'unequip', equippedItemId: 5n });
      });
    });
  },
);

verifies(SwTraceables.SW_055_EQUIP_ENFORCES_THE_ITEMS_MIN_LEVEL, () => {
  describe('decideEquipAction — min-level gate', () => {
    it('blocks an item whose minLevel is above the character level, naming the requirement', () => {
      const d = decideEquipAction(99n, 'Chest', false, [], 4, 5);
      expect(d).toEqual({ kind: 'blocked', requiredLevel: 5 });
    });

    it('equips at exactly minLevel — the boundary is inclusive', () => {
      const d = decideEquipAction(99n, 'Chest', false, [], 5, 5);
      expect(d).toEqual({ kind: 'equip', slot: 'Chest', slotOrdinal: 0 });
    });

    it('blocks instead of replacing, so an under-level click never evicts the occupant', () => {
      const occ = equipped('Chest', 0, 1n);
      const d = decideEquipAction(99n, 'Chest', false, [occ], 4, 5);
      expect(d).toEqual({ kind: 'blocked', requiredLevel: 5 });
    });

    it('still unequips an already-equipped item that is above the character level', () => {
      const d = decideEquipAction(
        5n,
        'Chest',
        false,
        [equipped('Chest', 0, 5n)],
        4,
        5,
      );
      expect(d).toEqual({ kind: 'unequip', equippedItemId: 5n });
    });
  });
});
