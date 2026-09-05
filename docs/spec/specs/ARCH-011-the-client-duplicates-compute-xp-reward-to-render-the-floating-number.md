**Title**
The client duplicates computeXpReward to render the floating number

**Lens**: ARCH

**Status**: active

**Description**
`client/src/xpReward.ts` carries a byte-for-byte duplicate of
`spacetimedb/src/rules/leveling.ts#computeXpReward`, together with a copy
of the `xp` block of `content/config.json`, and the client computes the
floating reward text from the enemy row's level and the local character's
level.
The server does not publish the granted amount.
The two copies are
kept in sync by hand, as `client/src/levelCurve.ts` and
`client/src/handSlots.ts` already are.

**Rationale**
The floating text used to read `enemy.xpReward` straight off the row.
Once the reward depends on the killer, that column no longer holds the
number that was granted, and the client has no other source: rows carry
state, not the outcome of a reducer call.

The alternatives were worse.
Writing the granted amount back to the enemy
row would store a derived, per-killer value on a shared row — the exact
thing this module's header forbids.
Adding a client subscription to the
config would mean shipping the operator's balance file to every browser
for one number.
Duplication is the pattern this codebase has already
chosen twice at the same boundary, and it is the one with a precedent for
keeping the copies honest: a unit test asserting the client's output
matches the server formula across a swept range.

**Verification Description**
Two checks, because the duplication has two halves.
`client/src/xpReward.test.ts` sweeps level pairs and asserts the client's
_formula_ agrees with the server's, the same way
`client/src/levelCurve.test.ts` does for the level curve.
`content/config.test.ts` asserts the client's copied `xp` _config block_
still matches the shipped `content/config.json`.
The second lives on the
content side rather than beside the client copy because the client's
`tsconfig` cannot resolve the `node:fs` loader that reads the file.

## Relations

**Realizes**

- [SW-038](SW-038-enemy-level-renders-coloured-by-relative-difficulty-and-zero-reads-no-xp.md)

**Related**

- [ARCH-006](ARCH-006-client-level-curve-duplicates-compute-character-level-and-derives-thresholds-by-binary-search.md) — the same duplication decision for the level curve
- [ARCH-002](ARCH-002-client-effective-stats-is-a-hand-synced-duplicate.md) — the same decision for effective stats

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
- **2026-09-05** — Split the verification description into the formula check
  and the config-block check, and recorded where each lives.
  The original
  wording named only the formula sweep, which would have left the more
  dangerous half of the drift — a retuned `config.json` nobody mirrored into
  the client — with no named verification at all.
  No change in meaning to the
  decision itself.
