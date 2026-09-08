**Title**
Reaching level 10 stamps accountProgress.tutorialCompleted exactly once, on death

**Lens**: CON

**Status**: deprecated

**Description**
On death, if the dying character's level was >= 10 and
`accountProgress.tutorialCompleted` is not already true, it is set true —
and only then.
A character already past level 10 on a later death does
not re-trigger anything, since the check is gated on the flag already
being false, so this can only ever fire once per account.

**Rationale**
Marks a coarse "graduated the early game" milestone the client/site can
use later (e.g. to stop showing tutorial-oriented hints), tied to death
specifically — the moment account-level state is naturally already being
touched — rather than a separate check on every level-up.

**Verification Description**
A unit test kills a level-10+ character with `tutorialCompleted` false and
asserts it flips true; a second death afterward (with the flag already
true) asserts no error and the flag stays true, not re-toggled or
double-counted.

## Relations

**Realizes**

- [SYS-006](SYS-006-death-destroys-gear-and-un-attuned-cards-keeps-only-what-was-attuned.md)

**Related**

- [CON-033](CON-033-tutorial-completion-stamps-on-death-once-the-characters-zone-appropriate-max-level-was-reached.md) — supersedes this spec, keeping the mechanism and replacing the literal `10` with `zone.maxLevel`

## Changes

- **2026-09-08** — Deprecated by STR-014, superseded by `CON-033`.
  The
  death-gated, flips-at-most-once mechanism this spec pins is unchanged and
  survives verbatim in `CON-033`; only its threshold moves.
  The hardcoded
  `character.level >= 10` duplicated a number that now has a single source
  of truth (`hollow-vale.maxLevel` in `content/zones.json`), and the check
  is additionally scoped to a `tutorialZone: true` zone so that reaching a
  future high-level zone's cap does not graduate an account out of
  new-player status.
  Kept `deprecated` rather than removed so the existing
  anchor in `spacetimedb/src/index.ts` keeps building until STR-014 re-points
  it at `CON-033`; do not add new anchors to this spec.
