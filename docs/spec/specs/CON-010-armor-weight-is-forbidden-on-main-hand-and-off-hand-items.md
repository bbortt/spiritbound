**Title**
Armor weight is forbidden on main-hand and off-hand items

**Lens**: CON

**Status**: active

**Description**
`crossCheck` rejects any item with a non-null `armorWeight` whose slot is
`main_hand` or `off_hand` — weapons and focuses are never cloth/chain/
plate.

**Rationale**
Armor weight class (cloth/chain/plate) is a physical/magic-defense-bias
concept meaningful only for actual armor slots; a weapon or off-hand
focus has no such classification, so allowing one to carry it would be
dead, ambiguous data.

**Verification Description**
`content/equipment.test.ts` should assert a main_hand or off_hand item
with a non-null `armorWeight` is rejected. (Confirm this exists; add if
missing per this story's Acceptance Criteria on rejection-path coverage.)

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)
