**Title**
Reaching level 10 stamps accountProgress.tutorialCompleted exactly once, on death

**Lens**: CON

**Status**: active

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
