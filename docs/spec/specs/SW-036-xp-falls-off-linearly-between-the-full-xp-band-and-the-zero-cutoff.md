**Title**
XP falls off linearly between the full-XP band and the zero cutoff

**Lens**: SW

**Status**: active

**Description**
`computeXpReward(baseXp, monsterLevel, playerLevel, cfg)` returns, for
`diff = playerLevel - monsterLevel`:

- `diff <= 0` — base XP times a bonus of `1 + min(cap - 1, |diff| * 0.1)`.
- `0 < diff <= fullXpWithinLevels` — base XP unchanged.
- `diff >= zeroXpBeyondLevels` — zero.
- otherwise — base XP scaled linearly from full to zero across the band
  between the two thresholds.

The result is rounded to a whole number and is never negative.

**Rationale**
A cliff at the cutoff would make one level of drift swing a kill from full
reward to nothing, which reads as broken rather than as a difficulty
signal.
The linear ramp keeps the message ("you have outgrown this") legible
while it is happening.
Zero — rather than a token amount — beyond the
cutoff is what actually stops trivial farming; a small non-zero reward
would still be farmable at high kill rates.

**Verification Description**
`spacetimedb/src/rules/leveling.test.ts` covers equal levels, an
above-level monster at and beyond the bonus cap, both band edges, a
mid-band value asserted strictly between zero and base, and a far-below
monster returning exactly zero.

## Relations

**Realizes**

- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)

**Related**

- [SW-019](SW-019-grant-xp-raises-per-life-xp-and-lifetime-xp-in-one-call.md) — the grant this reward feeds

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
