**Title**
The first life is withheld until the prologue ends, but the death return is not

**Lens**: SW

**Status**: active

**Description**
In `GameScene`'s subscription callback, an account with no living
character and `accountProgress.prologueSeen` false launches
`PrologueScene` and does **not** call `startLife`.
The scene calls
`markPrologueSeen` and then `startLife` when it ends, by either route —
playing to the last beat and skipping are the same ending.
An account
with `prologueSeen` true keeps today's behaviour exactly: `startLife`
fires from the subscription callback with nothing in front of it.

The `startLife` call behind the death overlay's `RETURN` button is
explicitly **not** gated on this flag.

**Rationale**
Withholding the call is the point: launching the prologue _and_
`startLife` together would run the recitation over a live character
standing in the tutorial zone, taking damage, with the prologue's own
input handling competing with movement.
The cheapest correct ordering is
to not create the character yet.

The death-return path is excluded by argument, not by oversight.
It is
only reachable by an account that already had a life, so the flag is
necessarily already true — but gating it anyway would mean a future reset
of the flag, or a flag that failed to persist, silently replaces the
respawn button with a four-minute poem.
The exclusion makes the
respawn path independent of the prologue entirely.

**Verification Description**
A **unit** test is not the right level here — the behaviour is a branch
inside a Phaser scene's connection callback, reachable only with a live
subscription, and extracting it would leave a seam the production path
does not use.

Verified instead by **review** against two observable claims a reader can
check in `client/src/scenes/GameScene.ts`: the auto-`startLife` call site
is guarded by the flag, and the death-overlay `RETURN` handler's call
site is not.
The server half of the sequence — that
`mark_prologue_seen` is in fact what the scene calls before starting the
life — is covered by `CON-036`'s integration test.

## Relations

**Related**

- [STR-015](../stories/STR-015-the-prologue-plays-once-per-account-before-the-first-life.md) — the story delivering this decision
- [CON-036](CON-036-the-prologue-flag-is-account-scoped-server-held-and-flips-at-most-once.md) — the flag this branch reads
- [SW-053](SW-053-startlife-computes-the-start-zone-from-tutorial-completion-not-caller-input.md) — the reducer being withheld; what it does once called is unchanged by this spec
