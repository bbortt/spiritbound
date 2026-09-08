**Title**
Tutorial completion stamps on death once the character's zone-appropriate max level was reached

**Lens**: CON

**Status**: planned

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
A unit test kills a character at `zone.maxLevel` in a `tutorialZone: true`
zone with `tutorialCompleted` false and asserts it flips true; a death at
the same level in a non-tutorial zone (once one exists) asserts no flip;
a second death afterward with the flag already true asserts no error and
no re-toggle, exactly as `CON-008` already verifies for its own case.

## Relations

**Related**

- [STR-014](../stories/STR-014-zone-mastery-stops-xp-and-graduates-tutorial-accounts.md) — the story delivering this decision
- [CON-008](CON-008-first-reaching-level-ten-stamps-tutorial-completed-exactly-once.md) — superseded by this spec and marked `deprecated` at promotion; its hardcoded `character.level >= 10` is the literal this spec replaces with `zone.maxLevel`
