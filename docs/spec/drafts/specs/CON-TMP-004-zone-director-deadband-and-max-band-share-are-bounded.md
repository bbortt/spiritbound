**Title**
Zone director deadband and max band-share are bounded

**Lens**: CON

**Status**: planned

**Description**
A zone's `director.deadband` must be at least 1, and its
`population.maxBandSharePct` must fall within `[0.2, 1.0]` inclusive.
Either violation is rejected at validation.

**Rationale**
A deadband of 0 means any non-zero difference between target and actual
population triggers an action, so a single kill or a single player moving
between bands guarantees a spawn or despawn next tick — the director
oscillates forever instead of settling.
A `maxBandSharePct` below 0.2
would let one occupied band starve every other band of its share of the
budget even when demand is spread across several; above 1.0 the cap does
nothing at all.
Both are plain numeric guard-rails on the same
`director`/`population` tuning surface, so one spec and one test block
covers both.

**Verification Description**
`content/zones.test.ts` asserts the shipped `hollow-vale` config
(`deadband: 3`, `maxBandSharePct: 0.5`) validates, and that
`deadband: 0`, `maxBandSharePct: 0.1`, and `maxBandSharePct: 1.5` are each
rejected.

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)
