**Title**
Reaching a zone's max level stops its XP and graduates tutorial accounts onward

**Status**: active

**Business Value**
Without a ceiling, a player can keep farming a zone's mobs indefinitely
past the level range it was designed for, with no signal that they've
outgrown it.
This story gives every zone a hard, visible stopping point,
and closes the loop on the account's existing `tutorialCompleted` flag —
today that flag already changes a returning character's starting level,
but nothing yet ties it to the zone it actually happened in or to where a
graduated account should start its next life.

**Problem / Context**
`accountProgress.tutorialCompleted` already exists.
It already flips —
on death, exactly once — at a hardcoded `character.level >= 10`
(`spacetimedb/src/index.ts` around line 1137, currently pinned by the
active `CON-008`), and it already sets a returning character's starting
level to 10 (line 982) — but nothing about the threshold is data-driven,
and `startLife` currently trusts whatever `startZoneId` its caller
passes, with no server-side zone selection at all. `rules/leveling.ts`'s
`computeXpReward` has no notion of a zone ceiling — a character can
outlevel a zone's `maxLevel` and keep earning full or falling-off XP from
its mobs forever.

**Solution Approach**
`_grantXp`'s call site (in `damageEnemy`) checks the enemy's zone's
`maxLevel` before computing a reward at all: at or above it, grant zero
and skip `computeXpReward` entirely.
The client independently checks the
same condition (it already subscribes to `zone` and knows the local
character's level) to decide between the existing `No XP` case
(`SW-038`, a below-level-gap kill) and a new `Zone mastered` case — both
render zero, so the client must distinguish the _reason_, not just the
amount, exactly as `ARCH-011` already has it duplicate `computeXpReward`
for the same purpose.

`CON-008`'s existing hardcoded `character.level >= 10` death-gated check
is **superseded** by a new spec pinning the same mechanism against
`character.level >= zone.maxLevel` for a `tutorialZone: true` zone,
instead of the literal `10` — the death-gating and flip-once behavior are
unchanged, only the threshold and zone-scoping.
Separately — and this is
a distinct trigger, not the same one — the first time a level-up pushes a
character's level to at-or-above a tutorial zone's `maxLevel` (a live,
in-play moment, not a death), the client shows a one-time centered
message sourced from that zone's `masteredMessage`, needing no new
persisted flag since a level-up crossing only ever happens once per
character.

`startLife` is changed to compute the zone itself from
`progress.tutorialCompleted` — mirroring how it already computes
`startLevel` from the same flag rather than trusting caller input — and
routes a graduated account to zone 2.
Zone 2 does not exist yet, so this
branch falls back to zone 1 with a `// TODO` rather than breaking.

**Acceptance Criteria**

- A kill by a character at or above their current zone's `maxLevel`
  grants exactly zero XP, and never reaches `computeXpReward`.
- The client shows `Zone mastered` (not `No XP`) specifically when the
  zero is caused by the zone cap, and still shows the existing `No XP`
  for an ordinary below-level-gap zero kill.
- `accountProgress.tutorialCompleted` flips, on death, based on the
  dying character's zone's `maxLevel`, not the literal `10`; a tutorial
  zone whose `maxLevel` were ever authored differently would graduate at
  that value instead.
- The one-time "has nothing left to teach you" message appears exactly
  once, the first time a tutorial zone's `maxLevel` is reached, sourced
  from that zone's `masteredMessage`.
- A fresh `startLife` call for a `tutorialCompleted: true` account
  resolves to zone 2 if it exists, otherwise falls back to zone 1 without
  throwing.

**Out of scope**

- Creating zone 2's actual content — the fallback exists specifically so
  this story ships without it.
- Any change to what happens when a character is _below_ a zone's
  `minLevel` (not addressed by this story; drop/XP eligibility already
  handles under-level cases via `SYS-011`).

## Relations

**Realizes**

- [SW-050](../specs/SW-050-xp-grant-returns-zero-at-or-above-the-zones-max-level.md)
- [SW-051](../specs/SW-051-zone-mastered-displays-only-when-the-zero-is-caused-by-the-zone-cap.md)
- [SW-052](../specs/SW-052-tutorial-completion-keys-off-the-zones-max-level-and-shows-a-one-time-message.md)
- [SW-053](../specs/SW-053-startlife-computes-the-start-zone-from-tutorial-completion-not-caller-input.md)
- [CON-033](../specs/CON-033-tutorial-completion-stamps-on-death-once-the-characters-zone-appropriate-max-level-was-reached.md)

**Related**

- [SW-036](../specs/SW-036-xp-falls-off-linearly-between-the-full-xp-band-and-the-zero-cutoff.md) — the existing zero case this story adds a second, distinct cause alongside
- [SW-038](../specs/SW-038-enemy-level-renders-coloured-by-relative-difficulty-and-zero-reads-no-xp.md) — the existing `No XP` display this story's `Zone mastered` must not be confused with
- [ARCH-011](../specs/ARCH-011-the-client-duplicates-compute-xp-reward-to-render-the-floating-number.md) — the client-duplication pattern this story's zone-cap check follows
- [SYS-011](../specs/SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md) — the sibling level-gap XP capability this zone cap sits alongside
- [CON-008](../specs/CON-008-first-reaching-level-ten-stamps-tutorial-completed-exactly-once.md) — superseded by `CON-033`; the hardcoded `10` this story replaces with `zone.maxLevel`
