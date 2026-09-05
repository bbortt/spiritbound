**Title**
The above-level XP bonus is capped so over-pulling never pays

**Lens**: CON

**Status**: active

**Description**
The XP multiplier for killing an above-level enemy grows at `0.1` per
level of difference and is clamped by `higherLevelBonusCap`, which the
config schema bounds to `1.0`–`3.0` and the shipped config sets to `1.5`.
No level difference, however large, pays more than the cap.

**Rationale**
Under permadeath the reward curve is also a risk curve.
An uncapped
bonus would make pulling far above your level the fastest progression in
the game right up to the death that ends the character — an incentive to
gamble the whole run, which is the opposite of the "preparation over
reaction" pillar.
The cap keeps fighting up worthwhile (a modest edge over
grinding equals) without making it optimal.

**Verification Description**
`spacetimedb/src/rules/leveling.test.ts` asserts a monster twenty levels
above the player pays exactly the capped multiple, and
`content/config.test.ts` asserts the shipped cap is at most 1.5.

## Relations

**Realizes**

- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)

**Related**

- [SW-036](SW-036-xp-falls-off-linearly-between-the-full-xp-band-and-the-zero-cutoff.md) — the reward curve this bounds

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
