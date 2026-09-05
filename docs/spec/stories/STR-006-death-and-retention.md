**Title**
Death & Retention — gear always lost, cards survive only if attuned

**Status**: active

**Business Value**
This is the mechanical core of permadeath itself: "death is (almost)
permanent" and "every drop has value" both cash out here — gear always
dies with the body (feeding the economy), while cards survive only by a
deliberate advance choice (attunement), never a coin flip.

**Problem / Context**
Retrofit story: this logic already shipped (`spacetimedb/src/rules/death.ts`,
`_handleDeath`, `sacrificeCard`, `toggleAttune` in `index.ts`).
No spec
currently records what it does, so nothing catches a future regression
(e.g. a slot-budget miscount, gear accidentally surviving) as a spec
violation rather than a silent behavior change.

**Solution Approach**
Author SW specs for `computeRetention`, `computeAttunementSlots`,
`computeSpiritLevel`/sacrifice, `toggleAttune`'s slot enforcement, and
`_handleDeath`'s unconditional gear destruction plus its no-personal-spirit
edge case; one CON for the one-time tutorial-completion stamp.
Anchor each
to the existing code, adding vitest unit tests in a new
`spacetimedb/src/rules/death.test.ts` (shared with the XP & Leveling
story's `computeCharacterLevel` tests — both stories contribute cases to
the same file, since it tests the same source file).

**Acceptance Criteria**

- Every spec anchored to the implementing code.
- `computeSpiritLevel`, `computeAttunementSlots`, and `computeRetention`
  each have a vitest unit test in `spacetimedb/src/rules/death.test.ts`.
- `clew coverage` shows every spec in this story as Covered.
- No existing death/retention/sacrifice/attune behavior changed — this is
  a documentation-and-test retrofit, not a feature change.

**Out of scope**

- What the Hand (equipped cards during life) can hold, or how it's
  changed — covered by the Hand/Card Management story.
  This story is only
  what happens to cards/gear/spirit AT the moment of death, plus the
  sacrifice/attune mechanics that prepare for it.
- Group revive, alliance mechanics — listed as future/open questions in
  `CLAUDE.md`, not built.

## Relations

**Realizes**

- [SYS-006](../specs/SYS-006-death-destroys-gear-and-un-attuned-cards-keeps-only-what-was-attuned.md)
- [SW-022](../specs/SW-022-only-attuned-cards-survive-consuming-a-rarity-slot-each.md)
- [SW-023](../specs/SW-023-attunement-slots-per-rarity-grow-with-spirit-level-legendary-gated-at-thirty.md)
- [SW-024](../specs/SW-024-spirit-level-is-a-log-shaped-curve-over-bond-xp.md)
- [SW-025](../specs/SW-025-attuning-past-a-rarity-slot-budget-is-rejected-un-attuning-never-is.md)
- [SW-026](../specs/SW-026-death-always-destroys-gear-and-a-spiritless-account-loses-every-card.md)
- [CON-008](../specs/CON-008-first-reaching-level-ten-stamps-tutorial-completed-exactly-once.md)
