**Title**
Main-hand items require full weapon geometry; every other slot forbids it

**Lens**: CON

**Status**: active

**Description**
An item with `slot: 'main_hand'` must have non-null `weaponSchool`,
`geometryShape`, `geometryWidth`, and `geometryRange`; an item with any
other slot (including null/non-equippable) must have all four fields
null — both directions enforced by `ItemSchema`'s `superRefine`.

**Rationale**
A weapon's damage school and swing geometry are meaningless outside the
main hand (only the wielded weapon determines how an attack reaches its
target — see the Combat Resolution story's `SW-008`), so allowing
these fields anywhere else would create ambiguous, unused data with no
consumer.

**Verification Description**
`content/equipment.test.ts` should assert a main_hand item missing one of
the four fields is rejected, and a non-main_hand item with one of the
four fields set is rejected. (Confirm this exists; add if missing per
this story's Acceptance Criteria on rejection-path coverage.)

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)
