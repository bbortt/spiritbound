**Title**
A tutorial zone's minLevel must be one

**Lens**: CON

**Status**: active

**Description**
A zone with `tutorialZone: true` must have `minLevel === 1`.
A tutorial
zone whose `minLevel` is anything else is rejected at validation.

**Rationale**
`tutorialZone` marks the zone every fresh account's first life starts in.
If its `minLevel` could drift away from 1, a new character could spawn
below the zone's own level floor — a state the level-band and population
config have no way to represent, since band 0 exists specifically to
cover from `minLevel`.
Pinning the two fields together at validation time
turns a content-authoring mistake into a rejected file instead of a
level-1 character standing in a zone that doesn't expect them.

**Verification Description**
`content/zones.test.ts` asserts the shipped `hollow-vale`
(`tutorialZone: true, minLevel: 1`) validates, and that a mutation setting
`minLevel: 2` on a `tutorialZone: true` entry is rejected.

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)

## Changes

- **2026-09-08** — Set active: implementation of STR-010 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
