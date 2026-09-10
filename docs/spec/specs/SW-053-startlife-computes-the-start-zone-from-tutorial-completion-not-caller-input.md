**Title**
startLife computes the start zone from tutorial completion, not caller input

**Lens**: SW

**Status**: active

**Description**
`startLife` computes the character's starting `zoneId` itself from
`progress.tutorialCompleted` — zone 2 if `true`, zone 1 otherwise —
mirroring how it already computes `startLevel` from the same flag rather
than trusting the reducer's `startZoneId` argument.
The `true` branch is keyed on **whether the graduate zone is actually
seeded**: `startLife` looks the zone up and routes there only if the row
exists, falling back to the tutorial zone if it does not.
So while zone 2 is unauthored a graduate restarts in zone 1, and the day
zone 2 is seeded the routing changes by itself — no code edit, no flag.
A graduate's starting level is a separate decision, pinned by `CON-035`.

**Rationale**
Server authority means the client should not be the one deciding which
zone a graduated account starts in, any more than it decides their
starting level — `startLevel` already established this pattern in the
same reducer.

Keying the fallback on the zone row's existence rather than on a
`// TODO:` to be deleted later makes content, not code, the trigger.
A marker that has to be found and removed by hand is a promise someone has
to keep; a lookup that already reads the world keeps itself, cannot be
forgotten, and stays correct if zone 2 is ever unseeded again — while
still refusing to route a character into a zone that does not exist.

**Verification Description**
An integration test asserts a `tutorialCompleted: false` account's
`startLife` call resolves to the tutorial zone; a `tutorialCompleted: true`
account's call resolves to a zone that is actually seeded — zone 1 today,
via the existence check, and zone 2 once it ships — and neither throws nor
routes to a missing zone.
The assertion is on the chosen zone being seeded, so it does not have to
be rewritten when zone 2 lands.

## Relations

**Realizes**

- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)

**Related**

- [CON-035](CON-035-a-graduated-account-starts-below-its-start-zones-max-level.md) — the level the zone this picks has to leave room for

## Changes

- **2026-09-10** — Replaced the prescribed `// TODO:` fallback with the
  seeded-zone lookup the implementation actually uses.
  The spec said "only the guard's condition needs to be removed", which
  describes a marker nobody would ever be prompted to remove; the shipped
  branch keys on whether zone 2's row exists, so content seeding flips the
  routing on its own.
  That is strictly better than what was specified, so the text moved to the
  code rather than the other way around.
- **2026-09-08** — Set active: implementation of STR-014 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
