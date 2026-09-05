**Title**
Enemy level renders coloured by relative difficulty and zero reads "No XP"

**Lens**: SW

**Status**: active

**Description**
Each enemy renders its level above its HP bar as `Lv N`, coloured by the
difference against the local character's level: grey at three or more
below, white within two either way, yellow one to three above, red four or
more above.
The colour updates when either level changes.

On a kill, the floating reward text shows the scaled XP; when the scaled
reward is zero it shows a grey `No XP` instead of `+0 XP`.

**Rationale**
Once XP depends on the level gap, the gap has to be visible before the
fight, not inferred from the reward after it — the colour is the whole
interface to the new rule.
`No XP` rather than `+0 XP` because zero is a
category ("this is beneath you"), not a quantity, and reading it as a
number invites the player to wonder whether something failed.

**Verification Description**
Manual/browser QA per the UI testing rule in `005-testing-contract.md`:
at level 1 beside a level-2 enemy the label is yellow; after levelling to
10 the same enemy reads grey and its kill shows `No XP`.
The pure
colour-band decision is unit-tested in `client/src/enemyLevelBand.test.ts`.

## Relations

**Realizes**

- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)

**Related**

- [ARCH-011](ARCH-011-the-client-duplicates-compute-xp-reward-to-render-the-floating-number.md) — how the client knows the scaled value

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
