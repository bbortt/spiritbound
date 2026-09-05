**Title**
Rarity weights must sum to one and the error names the actual sum

**Lens**: SW

**Status**: active

**Description**
The config validator rejects a `dropRates` category whose five rarity
weights do not sum to 1.0 (within a small floating-point tolerance), and
the rejection message states the sum it actually computed alongside the
category it came from.
Each individual weight, and each `baseChance`, must
lie in `0.0`–`1.0`.

**Rationale**
A weight table that does not sum to one silently biases or truncates the
rarity roll — `pickWeightedRarity` walks a cumulative range, so a short
table quietly over-returns the fallback tier and a long one makes the last
tiers unreachable.
That is invisible in play and only shows up as a drop
distribution nobody can explain.
Naming the actual sum turns a
five-number hunt into a one-line fix, which matters because the person
reading this error is a server operator, not the author of the validator.

**Verification Description**
`content/config.test.ts` asserts the shipped file's weights sum to 1.0 for
both categories, and that a mutated table summing to 0.9 is rejected with
an error containing `0.9`.

## Relations

**Realizes**

- [SYS-009](SYS-009-server-operators-tune-balance-through-a-validated-config-file.md)

**Related**

- [SW-017](SW-017-a-rarity-tier-is-weight-picked-then-sampled-within-tier.md) — the cumulative roll this table feeds

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
