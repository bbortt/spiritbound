**Title**
Content Validation — cards.json/equipment.json are Zod-validated and idempotently seeded

**Status**: active

**Business Value**
Cards and items are the substance of both the ability-balancer and
item-balancer domains; a validated, single-source-of-truth content
pipeline is what lets those domains be edited safely by a human (or a
future non-engineer) without ever producing an invalid or
economy-breaking definition, and without the live database and the
authored file silently diverging.

**Problem / Context**
Retrofit story: `content/validate.ts` (cards) and
`content/validateEquipment.ts` (equipment) already exist and ship, each
with an existing `*.test.ts` covering some but not necessarily all of
their cross-field rules.
No spec currently records what each rule
requires or why, so a future edit to either validator has nothing to check
itself against beyond "does the existing test still pass."

**Solution Approach**
Author one SW spec for the idempotent-upsert-by-slug seeding behavior,
seven CON specs — one per distinct cross-field/schema rule the two
validators already enforce — and one ARCH spec restating the existing
`node:fs`-loader-split decision.
Anchor each to the implementing code and
to the existing `content/cards.test.ts`/`content/equipment.test.ts` (or a
new test case added to them where a rule isn't yet covered).

**Acceptance Criteria**

- Every spec anchored to `content/validate.ts`/`content/validateEquipment.ts`
  and to a passing test case in `content/cards.test.ts`/
  `content/equipment.test.ts` (adding a case where one is missing).
- Research for this story found a structural coverage gap, not a one-off:
  every existing test for `CON-009` through `CON-015` only asserts
  that the real, currently-shipped content complies with the rule — none
  constructs a synthetic invalid fixture to confirm the validator actually
  _rejects_ a violation.
  The anchoring pass must add a rejection-path test
  case for each of those seven CON specs, not just rely on the existing
  compliance-only cases.
- `SW-030` (idempotent slug-keyed seeding/upsert) currently has **zero**
  test coverage — both existing test files only exercise validation, never
  the seed/upsert step itself.
  The anchoring pass must add this test.
- `clew coverage` shows every spec in this story as Covered.
- No existing validation behavior changed — this is a documentation-and-
  test retrofit, not a rule change.

**Out of scope**

- The equipment/card _data itself_ (specific stat numbers, which items
  exist) — owned by `ability-balancer`/`item-balancer`, not a spec
  concern.
- The equip/drop mechanics that consume validated content — covered by
  the Equipment, Drop System, and Hand/Card Management stories.

## Relations

**Realizes**

- [SYS-008](../specs/SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)
- [SW-030](../specs/SW-030-seeding-upserts-content-by-slug-re-running-is-always-safe.md)
- [CON-009](../specs/CON-009-main-hand-items-require-full-weapon-geometry-everything-else-forbids-it.md)
- [CON-010](../specs/CON-010-armor-weight-is-forbidden-on-main-hand-and-off-hand-items.md)
- [CON-011](../specs/CON-011-epic-items-need-a-stat-of-twenty-legendary-items-need-forty.md)
- [CON-012](../specs/CON-012-per-item-movespeed-and-evasion-modifiers-are-capped.md)
- [CON-013](../specs/CON-013-a-wide-main-hand-weapon-caps-its-total-damage-stats-at-twenty.md)
- [CON-014](../specs/CON-014-legendary-cards-need-minlevel-thirty-five-epic-cards-need-twenty.md)
- [CON-015](../specs/CON-015-a-ward-passive-card-must-have-zero-mp-cost.md)
- [ARCH-009](../specs/ARCH-009-content-loaders-are-split-from-pure-validators-so-spacetimedb-can-tree-shake-node-fs.md)
