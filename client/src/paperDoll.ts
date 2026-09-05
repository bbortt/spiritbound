import type { EquippedItem } from './db';
import { SwTraceables, realizes } from '../../src/clew/traceables/clew';

// [slotTag, ordinal, gridArea, placeholder label]
// Paper-doll layout: weapons flank the top row, the centre column is the
// body line (head -> neck -> chest -> hands -> legs -> boots), and paired
// accessories flank the body part they're worn near (earrings-head, rings-hands).
export const BODY_SLOTS: [string, number, string, string][] = [
  ['OffHand', 0, 'off', 'Off'],
  ['MainHand', 0, 'main', 'Main'],
  ['Earring', 0, 'ear0', 'Earring'],
  ['Head', 0, 'head', 'Head'],
  ['Earring', 1, 'ear1', 'Earring'],
  ['Necklace', 0, 'neck', 'Neck'],
  ['Chest', 0, 'chest', 'Chest'],
  ['Ring', 0, 'ring0', 'Ring'],
  ['Hands', 0, 'hands', 'Hands'],
  ['Ring', 1, 'ring1', 'Ring'],
  ['Legs', 0, 'legs', 'Legs'],
  ['Boots', 0, 'boots', 'Boots'],
];

function rarityTag(v: unknown): string {
  return String((v as any)?.tag ?? v);
}

/** The equipped item occupying a given (slot tag, ordinal) pair, or undefined if empty. */
export const findEquippedInSlot = realizes(
  SwTraceables.SW_005_PAPER_DOLL_GRID_FIXES_EACH_SLOT_TO_ONE_POSITION,
  function findEquippedInSlot(
    equipped: EquippedItem[],
    slotTag: string,
    ordinal: number,
  ): EquippedItem | undefined {
    return equipped.find(
      (e) => rarityTag(e.slot) === slotTag && e.slotOrdinal === ordinal,
    );
  },
);
