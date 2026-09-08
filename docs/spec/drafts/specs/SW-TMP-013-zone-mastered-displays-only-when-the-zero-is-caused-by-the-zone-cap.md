**Title**
"Zone mastered" displays only when the zero is caused by the zone cap, not the level gap

**Lens**: SW

**Status**: planned

**Description**
On a kill that grants zero XP, the client independently evaluates whether
`character.level >= zone.maxLevel` for the character's current zone
(mirroring the server check in `SW-TMP-012`) to decide the floating-text
reason: if the zone cap is why, it shows a grey `Zone mastered` instead
of the existing grey `No XP` (`SW-038`).
If the zero is instead caused by
the level-gap falloff (the character is _not_ at the zone cap, but the
enemy is too far below their level), it still shows `No XP` exactly as
before.
Both are grey; only the wording differs.

**Rationale**
The server's grant amount alone (zero) cannot distinguish the two causes,
and conflating them would show a misleading `No XP` to a player who has
actually mastered the zone entirely — a materially different, better
piece of information than "this particular kill was beneath you." This
follows the same client-duplication approach `ARCH-011` already
establishes for `computeXpReward` itself.

**Verification Description**
`client/src/enemyLevelBand.test.ts` (or its sibling covering the
floating-XP-text decision) asserts a character at the zone cap killing
any eligible mob shows `Zone mastered`, and a character below the zone
cap killing a far-below-level mob still shows the existing `No XP`.

## Relations

**Realizes**

- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)

**Related**

- [SW-038](SW-038-enemy-level-renders-coloured-by-relative-difficulty-and-zero-reads-no-xp.md) — the existing `No XP` display this must not be confused with
- [ARCH-011](ARCH-011-the-client-duplicates-compute-xp-reward-to-render-the-floating-number.md) — the client-duplication pattern this follows
