**Title**
Equipment system — items, slots, effective stats, and the paper-doll sheet

**Status**: active

**Business Value**
"Gear is your body" is one of the game's four core pillars (`CLAUDE.md`):
gear is the permanent economy sink (lost on every death, per the design
pillar "every drop has value"), and equipping it is how a player's combat
stats actually change moment to moment, distinct from the permanent,
death-surviving progression cards carry.
Without a correct, well-understood
equip/effective-stats loop, gear has no felt weight and the death-loss
mechanic has nothing to bite on.

**Problem / Context**
This is a retrofit story: the equipment system (content pipeline, server
tables and reducers, effective-stats computation, and the client
inventory/character-sheet UI) already shipped in a prior session and is
live in the codebase.
No spec currently records what it actually does, so
there is nothing for the code to anchor to and nothing that would catch a
future regression (e.g. a slot-matching bug, a duplicated stat-mirroring
drift between server and client) as a spec violation rather than a
silently-changed behavior.
This story captures the system as it stands
today.

**Solution Approach**
Author SW specs for each observable equip-flow behavior (ownership/slot-type
gating, same-slot-ordinal replacement, proportional HP/MP rescaling,
additive effective-stats stacking, the paper-doll grid layout, and the
inventory's click-to-equip ordinal resolution), two ARCH specs (the
accepted `itemInstance`/`equippedItem` public-table exposure, and the
client-side effective-stats duplication), and one SYS spec for the
umbrella capability.
Anchor each to the existing implementing
code; add vitest unit tests (and anchor them too) for every piece that is
pure logic rather than DOM/Phaser rendering — extracting that logic into
its own module first where it currently sits inline in a UI class, per
`005-testing-contract.md`.

**Acceptance Criteria**

- Every spec below is anchored to the code that already realizes it.
- `effectiveStats.ts`'s `computeEffectiveStats` and a newly-extracted
  paper-doll slot-resolution function each have a vitest unit test the
  corresponding SW spec's `verifies` anchor points to.
- `clew coverage` shows every spec in this story as Covered.
- No existing equip/unequip/effective-stats behavior changed — this is a
  documentation-and-test retrofit, not a feature change.

**Out of scope**

- Gear _drops_ (roll chance, rarity weighting, level-gating) — covered by
  the Drop System story.
- The `cards.json`/`equipment.json` Zod validation rules themselves —
  covered by the Content Validation story.
- A real Race table, ward-passive stats, item sets — all explicitly listed
  as not-yet-built in `CLAUDE.md`'s Next Steps; no spec is written for
  work that doesn't exist yet.

## Relations

**Realizes**

- [SYS-001](../specs/SYS-001-equip-gear-to-change-combat-stats.md) — the system-level capability
- [SW-001](../specs/SW-001-equip-requires-ownership-and-matching-slot.md)
- [SW-002](../specs/SW-002-equip-auto-replaces-same-slot-ordinal-occupant.md)
- [SW-003](../specs/SW-003-gear-change-rescales-current-hp-mp-proportionally.md)
- [SW-004](../specs/SW-004-effective-stats-stack-race-base-with-gear-additively.md)
- [SW-005](../specs/SW-005-paper-doll-grid-fixes-each-slot-to-one-position.md)
- [SW-006](../specs/SW-006-inventory-click-picks-first-empty-dual-slot-ordinal.md)
- [ARCH-001](../specs/ARCH-001-item-tables-public-with-client-side-ownership-filter.md)
- [ARCH-002](../specs/ARCH-002-client-effective-stats-is-a-hand-synced-duplicate.md)
