**Title**
The XP level band must be ordered and the bonus cap bounded to 1.0–3.0

**Lens**: SW

**Status**: active

**Description**
The config validator rejects an `xp.levelDiffPenalty` whose
`fullXpWithinLevels` is not strictly less than `zeroXpBeyondLevels`, and
rejects a `higherLevelBonusCap` outside the inclusive range `1.0`–`3.0`.
Every duration in seconds and every distance in pixels the config declares
must be positive.

**Rationale**
The two band edges define a linear falloff between them; equal or inverted
edges divide by zero or invert the curve, so the ordering is not a style
preference but the precondition for the formula to mean anything.
The cap
bound is a balance guard: below 1.0 an above-level kill would pay _less_
than an equal-level one, and a large cap would make suicidal over-pulling
the fastest way to level under permadeath — the exact incentive the cap
exists to remove.

**Verification Description**
`content/config.test.ts` asserts the shipped `higherLevelBonusCap` is at
most 1.5 and that the band edges are ordered, and that configs violating
either bound are rejected.

## Relations

**Realizes**

- [SYS-009](SYS-009-server-operators-tune-balance-through-a-validated-config-file.md)

**Related**

- [CON-018](CON-018-the-above-level-xp-bonus-is-capped-so-over-pulling-never-pays.md) — the balance invariant this bound protects

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
