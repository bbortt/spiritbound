**Title**
Reaching a tutorial zone's max level for the first time shows a one-time centered message

**Lens**: SW

**Status**: planned

**Description**
When a level-up (from an XP grant) pushes a character's level from below
to at-or-above their current zone's `maxLevel`, and that zone has
`tutorialZone: true`, the client shows a one-time centered message
sourced from that zone's `masteredMessage` content field.
This is a live,
level-up-triggered event, independent of `CON-033`'s death-gated
`accountProgress.tutorialCompleted` flip — no new persisted flag is
needed, since a character's level only ever increases, so the
below-to-at-or-above transition happens at most once per character.

**Rationale**
The brief calls for the message "on first reaching maxLevel," which is a
moment during play, not at death — conflating it with `CON-033`'s
death-gated flag would show it late (only if and when the character next
dies) or not at all for a character who starts a new life already at the
zone's cap (a graduated account's next life starts at that level, per
`SW-053`, and correctly never re-shows the message, since there is no
crossing transition for it to react to).

**Verification Description**
A client test (or reviewed manual QA per `005-testing-contract.md`)
confirms the message shows exactly once, on the kill/level-up whose
resulting level first reaches `zone.maxLevel` in a `tutorialZone: true`
zone, and does not show again on a subsequent kill, nor for a character
who starts a life already at or above that level.

## Relations

**Realizes**

- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)

**Related**

- [CON-033](CON-033-tutorial-completion-stamps-on-death-once-the-characters-zone-appropriate-max-level-was-reached.md) — the separate, death-gated account milestone this message does not depend on
- [SW-050](SW-050-xp-grant-returns-zero-at-or-above-the-zones-max-level.md) — the same threshold this message's trigger reads
