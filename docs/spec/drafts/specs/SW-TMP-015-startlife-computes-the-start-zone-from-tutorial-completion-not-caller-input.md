**Title**
startLife computes the start zone from tutorial completion, not caller input

**Lens**: SW

**Status**: planned

**Description**
`startLife` computes the character's starting `zoneId` itself from
`progress.tutorialCompleted` — zone 2 if `true`, zone 1 otherwise —
mirroring how it already computes `startLevel` from the same flag rather
than trusting the reducer's `startZoneId` argument.
Since zone 2 does not
exist yet, the `true` branch falls back to zone 1 with a `// TODO:` marker
rather than routing to a non-existent zone.

**Rationale**
Server authority means the client should not be the one deciding which
zone a graduated account starts in, any more than it decides their
starting level — `startLevel` already established this pattern in the
same reducer.
Writing the branch now, guarded to fall back safely, means
the reducer doesn't need to change shape again the moment zone 2 ships;
only the guard's condition needs to be removed.

**Verification Description**
A unit or integration test asserts a `tutorialCompleted: false` account's
`startLife` call resolves to zone 1 as today; a `tutorialCompleted: true`
account's call also resolves to zone 1 (via the guarded fallback, since
zone 2 doesn't exist), and does not throw or route to a missing zone.

## Relations

**Realizes**

- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)
