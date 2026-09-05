**Title**
Equipping into an occupied slot+ordinal silently deletes the prior occupant

**Lens**: SW

**Status**: active

**Description**
`equipItem` looks up any existing `equippedItem` row for the same
character with the same `slot.tag` and `slotOrdinal`.
If one exists, it is
deleted in the same reducer call before the new `equippedItem` row is
inserted — there is no separate "slot occupied" error.
Dual-slot types
(ring, earring) use `slotOrdinal` 0/1 to distinguish the two instances of
the slot; every other slot always uses ordinal 0.

**Rationale**
A slot can hold at most one item; the alternative (rejecting the call and
forcing an explicit unequip first) would make gear-swapping a two-step
round trip for every single change, with no corresponding safety benefit —
the old item is not lost, it returns to the bag as an `itemInstance` still
owned by the character.

**Verification Description**
A unit or integration test equips item A into `(main_hand, 0)`, then
equips item B into `(main_hand, 0)`, and asserts exactly one `equippedItem`
row remains for that character/slot/ordinal, referencing item B's
instance.

## Relations

**Realizes**

- [SYS-001](SYS-001-equip-gear-to-change-combat-stats.md)

**Related**

- [SW-006](SW-006-inventory-click-picks-first-empty-dual-slot-ordinal.md) — the client-side decision of which ordinal a click targets
