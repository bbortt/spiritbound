**Title**
"Zone mastered" displays only when the zero is caused by the zone cap, not the level gap

**Lens**: SW

**Status**: active

**Description**
On a kill that grants zero XP, the client independently evaluates whether
`character.level >= zone.maxLevel` for the character's current zone
(mirroring the server check in `SW-050`) to decide the floating-text
reason: if the zone cap is why, it shows a grey `Zone mastered` instead
of the existing grey `No XP` (`SW-038`).
If the zero is instead caused by
the level-gap falloff (the character is _not_ at the zone cap, but the
enemy is too far below their level), it still shows `No XP` exactly as
before.
Both are grey; only the wording differs.

The client reads its own character's zone while the server (`SW-050`)
reads the killed enemy's.
They agree because a client only ever renders a corpse it can see, and it
only subscribes to enemies in the zone its character is standing in — the
two zones are the same row.

**Rationale**
The server's grant amount alone (zero) cannot distinguish the two causes,
and conflating them would show a misleading `No XP` to a player who has
actually mastered the zone entirely — a materially different, better
piece of information than "this particular kill was beneath you." This
follows the same client-duplication approach `ARCH-011` already
establishes for `computeXpReward` itself.

**Verification Description**
`client/src/zoneMastery.test.ts` — the unit test beside
`client/src/zoneMastery.ts#classifyKillXp`, which is where this decision
lives — asserts a character at the zone cap killing any eligible mob shows
`Zone mastered`, a character below the zone cap killing a far-below-level
mob still shows the existing `No XP`, a paying kill reports its amount,
the ceiling applies in a non-tutorial zone too, and an unknown zone row
falls back to the plain reward curve.

## Relations

**Realizes**

- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)

**Related**

- [SW-038](SW-038-enemy-level-renders-coloured-by-relative-difficulty-and-zero-reads-no-xp.md) — the existing `No XP` display this must not be confused with
- [ARCH-011](ARCH-011-the-client-duplicates-compute-xp-reward-to-render-the-floating-number.md) — the client-duplication pattern this follows

## Changes

- **2026-09-10** — Pointed the verification at `client/src/zoneMastery.test.ts`
  and noted why the client's zone and the server's are the same row.
  The named file, `client/src/enemyLevelBand.test.ts`, covers the level-band
  colouring of `SW-038` and has nothing to do with this decision; a reader
  checking coverage would have found the wrong tests and concluded the spec
  was unverified.
- **2026-09-08** — Set active: implementation of STR-014 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
