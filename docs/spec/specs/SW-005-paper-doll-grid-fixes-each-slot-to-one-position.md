**Title**
The character sheet's paper-doll grid fixes each equip slot to one specific position in a 3-column/7-row layout

**Lens**: SW

**Status**: active

**Description**
`CharacterSheet.ts`'s `BODY_SLOTS` lays out all eleven equip slots
(counting the two ring and two earring ordinals separately) on a fixed
3-column × 7-row CSS grid, by row: `[off_hand] [—] [main_hand]` /
`[earring0] [head] [earring1]` / `[—] [neck] [—]` / `[—] [chest] [—]` /
`[ring0] [hands] [ring1]` / `[—] [legs] [—]` / `[—] [boots] [—]`.
Weapons
occupy the top row flanking nothing; earrings flank the head; rings flank
the hands; every other slot sits alone in the center column, reading
top-to-bottom as the body's line (head → neck → chest → hands → legs →
boots).
Each grid cell renders empty (a placeholder label) or filled
(the equipped item's name, rarity-tinted) by looking up whether any
`equippedItem` matches that cell's `(slot tag, ordinal)` pair — never by
render order or insertion order.

**Rationale**
A fixed, anatomically-suggestive layout (rings by the hands, earrings by
the head) reads at a glance without needing labels memorized, and a
slot's grid position must be stable and independent of what is currently
equipped (an empty ring slot stays in the ring position, it does not
collapse or reflow) so a player's spatial memory of "my rings are here"
never breaks.

**Verification Description**
The slot/ordinal lookup is extracted out of `CharacterSheet.ts` into its
own plain-TypeScript function (`client/src/paperDoll.ts`, per
`005-testing-contract.md`'s UI-logic-extraction rule) and unit-tested:
given a set of equipped-item rows, the correct one is returned for each of
the eleven `(slot, ordinal)` pairs, `undefined` is returned for an empty
pairing, and a row for a slot/ordinal pair with no matching grid cell
(should not occur, but the lookup must not throw) does not get confused
with a different cell's item.

## Relations

**Realizes**

- [SYS-001](SYS-001-equip-gear-to-change-combat-stats.md)

**Related**

- [SW-006](SW-006-inventory-click-picks-first-empty-dual-slot-ordinal.md) — shares the same slot/ordinal lookup shape from the inventory side
