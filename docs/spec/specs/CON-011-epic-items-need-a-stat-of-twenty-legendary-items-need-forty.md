**Title**
Epic items need a stat of twenty, legendary items need forty

**Lens**: CON

**Status**: active

**Description**
`crossCheck` requires at least one of an epic item's `stats` values to be
`>= 20`, and at least one of a legendary item's to be `>= 40` (checked
against the max of all present stat modifier values on that item).

**Rationale**
A rarity tier must actually feel stronger than the one below it — a
floor on the item's single best stat keeps an "epic" or "legendary" item
from shipping as reskinned common-tier power, even before a full stat
budget model exists (`docs/BALANCE.md`).

**Verification Description**
`content/equipment.test.ts` should assert an epic/legendary item whose
max stat value falls just under each threshold is rejected, and one at
exactly the threshold is accepted. (Confirm this exists; add if missing
per this story's Acceptance Criteria on rejection-path coverage.)

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)
