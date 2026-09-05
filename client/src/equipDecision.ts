import type { EquippedItem } from './db';
import { SwTraceables, realizes } from '../../src/clew/traceables/clew';
import { findEquippedInSlot } from './paperDoll';

export type EquipDecision =
  | { kind: 'unequip'; equippedItemId: bigint }
  | { kind: 'equip'; slot: string; slotOrdinal: number }
  | {
      kind: 'replace';
      occupant: EquippedItem;
      slot: string;
      slotOrdinal: number;
    };

/**
 * Decides what clicking an inventory item should do, given the character's
 * current equipped rows. Pure decision only — the caller is responsible for
 * any confirmation dialog and the actual equip/unequip reducer call.
 */
export const decideEquipAction = realizes(
  SwTraceables.SW_006_INVENTORY_CLICK_PICKS_FIRST_EMPTY_DUAL_SLOT_ORDINAL,
  function decideEquipAction(
    itemInstanceId: bigint,
    slotTag: string,
    isDual: boolean,
    equipped: EquippedItem[],
  ): EquipDecision {
    const myEquip = equipped.find((e) => e.itemInstanceId === itemInstanceId);
    if (myEquip) {
      return { kind: 'unequip', equippedItemId: myEquip.equippedItemId };
    }

    if (isDual) {
      const occ0 = findEquippedInSlot(equipped, slotTag, 0);
      if (!occ0) return { kind: 'equip', slot: slotTag, slotOrdinal: 0 };
      const occ1 = findEquippedInSlot(equipped, slotTag, 1);
      if (!occ1) return { kind: 'equip', slot: slotTag, slotOrdinal: 1 };
      return { kind: 'replace', occupant: occ0, slot: slotTag, slotOrdinal: 0 };
    }

    const occ = findEquippedInSlot(equipped, slotTag, 0);
    if (!occ) return { kind: 'equip', slot: slotTag, slotOrdinal: 0 };
    return { kind: 'replace', occupant: occ, slot: slotTag, slotOrdinal: 0 };
  },
);
