**Title**
A zone boss window must be shorter than its cycle

**Lens**: CON

**Status**: active

**Description**
A zone's `boss.windowMinutes` must be strictly less than
`boss.cycleMinutes`.
A zone where the window equals or exceeds the cycle
is rejected at validation.

**Rationale**
The boss cycle is: absent for `cycleMinutes` since it last despawned,
then alive for up to `windowMinutes` before it is force-despawned even if
unkilled.
If the window were allowed to equal or exceed the cycle, the
boss would never have a genuine "absent" period — a new spawn could
overlap or immediately follow the previous window's despawn, defeating
the "it is a window, not a persistent mob" design intent the boss-cycle
story states.

**Verification Description**
`content/zones.test.ts` asserts the shipped `hollow-vale` boss config
(`windowMinutes: 5 < cycleMinutes: 10`) validates, and that
`windowMinutes >= cycleMinutes` is rejected.

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)

## Changes

- **2026-09-08** — Set active: implementation of STR-010 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
