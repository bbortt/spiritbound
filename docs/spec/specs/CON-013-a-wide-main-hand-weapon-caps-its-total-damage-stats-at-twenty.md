**Title**
A wide main-hand weapon caps its total damage stats at twenty

**Lens**: CON

**Status**: active

**Description**
For a main_hand item with `geometryWidth > 1.0`, the sum of
`weaponDamage + physicalAttack + magicAttack` must not exceed 20 — the
"power-vs-area" balance rule: no weapon may be both wide/forgiving AND
high-damage.

**Rationale**
The boundary is deliberately `<= 20` (not a strict `<`), specifically
because the shipped starter item "Apprentice Staff" sits exactly at
6 (weaponDamage) + 14 (magicAttack) = 20 with width 1.8 — tightening this
to a strict `<` would retroactively break that item (`docs/BALANCE.md`
flags this exact judgment call explicitly).

**Verification Description**
`content/equipment.test.ts` should assert Apprentice Staff's exact values
pass validation, and a wide weapon at 21 combined damage stats is
rejected. (Confirm this exists; add if missing per this story's
Acceptance Criteria on rejection-path coverage.)

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)
