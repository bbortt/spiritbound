**Title**
One scheduled regen tick restores every alive character's HP and MP from its effective stats

**Lens**: SW

**Status**: active

**Description**
A scheduled reducer — `resourceRegen` — fires on a fixed interval and walks
every `character` row with `alive = true`.
For each one it reads `hpRegen`/`mpRegen` out of `buildEffectiveStats`, not
out of `computeRaceBase`, so a gear line that modifies either rate takes
effect without this reducer knowing gear exists.
The amount it grants, and the carry that makes a fractional rate work
against an `i32` column, are `SW-058`'s decision; the out-of-combat
gate — which the HP half of the tick consults and the MP half ignores — is
`SW-057`'s.
The reducer is the only writer of `currentHp`/`currentMp` it introduces:
it does not touch `lastLevelUpAt`, does not grant XP, and does not emit an
event.
A tick that has nothing to pay anybody writes no rows.

**Rationale**
Reading effective stats rather than race base is what makes `hpRegen` a
real gear stat instead of a race constant — `statModifiers` already carries
both columns on every `ItemDefinition`, and `computeEffectiveStats` already
sums them additively (`SW-004`), so the whole gear seam costs this reducer
one function call.
Skipping the write when nothing is owed matters because the tick is global:
with every character at full HP and out of combat, the common case is a
scan with no writes at all, and an unconditional
`character.update` per row per tick would turn an idle server into a
continuous stream of subscription updates to every connected client.

**Verification Description**
An integration test damages a character, waits past the out-of-combat delay
and over several tick intervals, and asserts `current_hp` has risen by the
rate the elapsed span implies and then stopped at the effective maximum.
A second assertion equips an item carrying an `hpRegen` modifier and
asserts the observed climb follows the modified rate, proving the value
came from effective stats rather than race base.

## Relations

**Realizes**

- [SYS-016](SYS-016-characters-recover-hp-and-mp-out-of-combat.md)

**Related**

- [SW-057](SW-057-out-of-combat-gates-hp-regen-only.md) — the gate this tick consults for HP
- [SW-058](SW-058-each-resource-carries-its-own-paid-up-to-stamp.md) — the amount this tick grants
- [SW-004](SW-004-effective-stats-stack-race-base-with-gear-additively.md) — the sum this reads
- [ARCH-015](ARCH-015-regen-is-one-global-schedule-sized-by-config.md) — why it is one schedule and not one per character

## Changes

- **2026-11-21** — Set active: implementation of STR-016 began.
  The spec is authored, reviewed and approved, so it now generates a
  traceable for the code written in this increment to anchor against.
