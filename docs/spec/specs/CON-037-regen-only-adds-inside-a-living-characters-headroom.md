**Title**
Regeneration only ever adds, only up to the effective maximum, and never to a dead character

**Lens**: CON

**Status**: active

**Description**
Three things hold on every regen tick, for every character:

- It never decreases `currentHp` or `currentMp`.
  A character whose effective maximum has just dropped below its current
  value — the case `_withProportionalResourceUpdate` already handles on a
  gear change — is left alone by regen rather than trimmed by it.
- It never raises either value above the effective maximum from
  `buildEffectiveStats`, clamping the grant rather than skipping it, so a
  character one HP short of full still receives that one HP.
- It never writes a row with `alive = false`.
  A dead character's row persists with its `diedAt` stamp, so a scan that
  filtered only on the rate would heal corpses.

**Rationale**
The clamp and the no-decrease rule are what keep regen a one-directional
effect that can be reasoned about next to the other two writers of these
columns: a level-up refills (`SW-020`) and a gear change rescales
proportionally (`SW-003`).
If regen also corrected downward, the three would fight over the same value
on the same tick and the result would depend on scheduling order.
The dead-character rule is not theoretical: permadeath keeps the row, the
death summary screen reads it, and `alive` is the only thing distinguishing
it — a corpse quietly climbing back to full HP in the database would be
visible on the summary screen and would make `diedAt` the only honest
column on the row.

**Verification Description**
An integration test asserts a character at full HP sees no `current_hp`
change across several tick intervals; a second kills a character and
asserts its `current_hp` is unchanged well past the out-of-combat delay;
and a third damages a character to one below its maximum and asserts it
lands exactly on the maximum rather than overshooting or stalling.

## Relations

**Realizes**

- [SYS-016](SYS-016-characters-recover-hp-and-mp-out-of-combat.md)

**Related**

- [SW-020](SW-020-a-level-increase-refills-hp-mp-and-stamps-the-level-up-timestamp.md) — the second writer of these columns
- [SW-003](SW-003-gear-change-rescales-current-hp-mp-proportionally.md) — the third, and the one that can put current above max
- [CON-001](CON-001-damage-never-resolves-below-min-damage.md) — the damage side's floor, which this mirrors on the recovery side
- [SW-058](SW-058-each-resource-carries-its-own-paid-up-to-stamp.md) — the amount this clamps

## Changes

- **2026-11-21** — Set active: implementation of STR-016 began.
  The spec is authored, reviewed and approved, so it now generates a
  traceable for the code written in this increment to anchor against.
