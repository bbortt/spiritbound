**Title**
A zone's minimum spawn distance must be strictly less than its despawn-safe distance

**Lens**: CON

**Status**: active

**Description**
A zone's `director.minSpawnDistFromPlayerPx` must be strictly less than
`director.despawnSafeDistPx`.
A zone where the two are equal or reversed
is rejected at validation.

**Rationale**
An enemy spawns no closer than `minSpawnDistFromPlayerPx` to any player,
and becomes despawn-eligible only once no player is within
`despawnSafeDistPx`.
If the spawn distance were ever allowed to equal or
exceed the despawn-safe distance, a freshly spawned enemy would be
immediately eligible for despawn on the very next director tick — spawns
and despawns would race at the spawn boundary, and the population never
stabilizes there.
This is the one invariant in the zone schema that is
safety-critical rather than merely a tuning sanity check, so it stays its
own spec rather than folding into the deadband/band-share guard-rail spec.

**Verification Description**
`content/zones.test.ts` asserts the shipped `hollow-vale` config
(`600 < 900`) validates, and that a mutation setting
`minSpawnDistFromPlayerPx >= despawnSafeDistPx` is rejected.

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)

## Changes

- **2026-09-08** — Set active: implementation of STR-010 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
