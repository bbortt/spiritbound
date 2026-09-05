**Title**
Clicking an unequipped item targets the first empty ordinal for dual-slot types, and confirms replacement otherwise

**Lens**: SW

**Status**: active

**Description**
Clicking an item in the inventory that is not currently equipped decides
where it goes without further input, except for a browser `confirm()`
when it would displace something: for `ring`/`earring` (dual-slot types),
if ordinal 0 is empty it equips there; else if ordinal 1 is empty it
equips there; else it asks to replace whatever occupies ordinal 0.
Every
other slot type always targets ordinal 0, asking to replace if occupied.
Clicking an item that _is_ already equipped instead asks to unequip it.
No inventory click ever silently overwrites an occupied slot without a
confirmation.

**Rationale**
Dual-slot types need a deterministic default (fill the first empty one)
so a player equipping two rings back-to-back doesn't have to specify
which ordinal each time; a confirmation before displacing an already-worn
item exists because unequipping is not itself destructive (the item
returns to the bag) but is still a state change worth a beat of friction
one step below the true one-way risk (a card sacrifice or gear loss on
death).

**Verification Description**
The click-to-slot decision is extracted out of `InventoryPanel.ts`'s
`_handleClick` into its own plain-TypeScript function (returning a
discriminated decision — equip / replace-with-confirmation / unequip —
rather than performing the DOM `confirm()` call itself, per
`005-testing-contract.md`), and unit-tested: an empty dual slot picks
ordinal 0 then 1, a full dual slot flags ordinal 0 for replacement, a
full single slot flags ordinal 0 for replacement, and clicking an
already-equipped instance decides unequip regardless of slot type.

## Relations

**Realizes**

- [SYS-001](SYS-001-equip-gear-to-change-combat-stats.md)

**Related**

- [SW-002](SW-002-equip-auto-replaces-same-slot-ordinal-occupant.md) — the server-side counterpart this client decision must stay consistent with
- [SW-005](SW-005-paper-doll-grid-fixes-each-slot-to-one-position.md)
