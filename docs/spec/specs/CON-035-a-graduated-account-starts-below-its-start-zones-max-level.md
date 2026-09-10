**Title**
A graduated account starts below its start zone's max level

**Lens**: CON

**Status**: active

**Description**
The level `startLife` gives a `tutorialCompleted: true` account is
strictly below the `maxLevel` of the zone that same call routes it to.
While zone 2 is unseeded and the graduated branch falls back to the
tutorial zone, that means a graduated life begins at level 8 in
`hollow-vale` (`maxLevel: 10`) rather than at the ceiling.

**Rationale**
`SW-050` grants zero XP at or above the zone's `maxLevel`.
A graduated account that starts _at_ the ceiling of the only zone it can
be placed in therefore cannot earn XP at all — the composition of two
individually correct rules produced an account with no progression, which
no single spec caught.
Pinning the relationship rather than the literal is what keeps that from
recurring: any future retune of a zone ceiling, or the arrival of zone 2
with its own range, is still checked against the level the account
actually starts at.
Two levels of headroom is the deliberate amount — the design's tutorial
skip promises "past the tutorial floor, not comfortable"
(`GAME_DESIGN.md`), so a graduate earns XP immediately and reaches zone
mastery again within a short session, which is the pressure that should
push them into zone 2 the moment it exists.

**Verification Description**
`spacetimedb/integration/tutorialCompletion.integration.test.ts` asserts
that the life started after graduation begins strictly below the
`maxLevel` of the zone it was routed into, reading both the character's
level and that zone's ceiling from the live module rather than restating
either literal.

## Relations

**Related**

- [SW-053](SW-053-startlife-computes-the-start-zone-from-tutorial-completion-not-caller-input.md) — the zone half of the same decision, computed in the same reducer
- [SW-050](SW-050-xp-grant-returns-zero-at-or-above-the-zones-max-level.md) — the zero-XP ceiling this constraint keeps a graduated account clear of
- [CON-033](CON-033-tutorial-completion-stamps-on-death-once-the-characters-zone-appropriate-max-level-was-reached.md) — the graduation event that produces the account this constrains

## Changes

- **2026-09-10** — Promoted active to close the XP-dead graduated account:
  `startLife` previously started a graduated life at a hardcoded level 10,
  which is exactly `hollow-vale`'s ceiling, so such an account could never
  earn XP again until zone 2 shipped.
  The starting level moves to 8 and the relationship — not the literal —
  is what this spec pins.
  The level-8 value is a stopgap while zone 2 is unauthored; it returns to
  10 when zone 2 ships, and this constraint holds either way.
