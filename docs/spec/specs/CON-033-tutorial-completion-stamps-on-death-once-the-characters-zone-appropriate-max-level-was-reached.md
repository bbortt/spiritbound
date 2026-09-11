**Title**
Tutorial completion stamps on death once the character's zone-appropriate max level was reached

**Lens**: CON

**Status**: active

**Description**
On death, if the dying character's zone (at time of death) has
`tutorialZone: true` and `character.level >= zone.maxLevel`, and
`accountProgress.tutorialCompleted` is not already `true`, it is set
`true` — and only then.
This **supersedes `CON-008`**, which pins the
same on-death, flip-once mechanism to a hardcoded `character.level >= 10`
regardless of zone.
The mechanism (death-gated, flips at most once) is
unchanged; only the threshold moves from a literal to
`zone.maxLevel`, and the check is now scoped to a `tutorialZone: true`
zone rather than any zone.

**Rationale**
`CON-008`'s hardcoded `10` duplicates a number that now has a single
source of truth: `hollow-vale.maxLevel` in `content/zones.json`.
Scoping
to `tutorialZone: true` matters once a second, non-tutorial zone exists —
reaching a high-level zone's cap should not itself graduate the account
out of "new player" status the way finishing the actual tutorial zone
does.

**Verification Description**
An **integration** test against a live published module levels a character
to the tutorial zone's authored `maxLevel` — read from the `zone` row, not
written as a literal — and asserts: reaching that level while alive does
**not** flip the flag (the stamp is death-gated); a lethal
`apply_damage` at that level flips `accountProgress.tutorialCompleted` to
true; a death one level below the ceiling leaves it false; and a second
death on an already-graduated account is an ordinary no-op rather than an
error or a re-toggle.
A death at the same level in a non-tutorial zone asserts no flip once a
second zone exists.

This is verified end-to-end rather than by unit test deliberately.
The flip reads the `zone` table, writes `account_progress`, and only ever
fires from inside `_handleDeath`; there is no pure function here to call.
Extracting one purely to satisfy a testing preference would be
manufacturing a seam that the production path does not use, and the
resulting test would prove the seam works rather than that the graduation
does.

## Relations

**Related**

- [STR-014](../stories/STR-014-zone-mastery-stops-xp-and-graduates-tutorial-accounts.md) — the story delivering this decision
- [CON-008](CON-008-first-reaching-level-ten-stamps-tutorial-completed-exactly-once.md) — superseded by this spec and marked `deprecated` at promotion; its hardcoded `character.level >= 10` is the literal this spec replaces with `zone.maxLevel`

## Changes

- **2026-09-10** — Replaced the unit-test requirement with an integration
  assertion, and said why the seam does not exist.
  The flip is only reachable through `_handleDeath` and touches two tables;
  a unit test would have to mock all three of those dependencies and would
  then be asserting the mock.
  `spacetimedb/integration/tutorialCompletion.integration.test.ts` covers
  it against a live module instead, reading the ceiling from the seeded
  `zone` row so the test follows re-authored content rather than passing
  against a stale literal.
- **2026-09-08** — Set active: implementation of STR-014 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
  The `_handleDeath` anchor `CON-008` was kept alive to carry now points here
  instead, so no live anchor names the deprecated spec any more.
