**Title**
Equip and unequip rescale current HP/MP proportionally to the max change, never clamp

**Lens**: SW

**Status**: active

**Description**
`equipItem` and `unequipItem` both wrap their mutation in
`_withProportionalResourceUpdate`: effective stats are computed before and
after the gear change, and `currentHp`/`currentMp` are multiplied by the
same ratio the max changed by (`after.maxHp / before.maxHp`,
`after.maxMp / before.maxMp`), then clamped to `[1, newMax]` for HP and
`[0, newMax]` for MP.
A character is never reduced to 0 HP by a gear
change alone (floor of 1), and never left above the new max.

**Rationale**
Simply clamping current HP/MP to the new max (instead of rescaling) would
let a player "bank" free effective healing by swapping to high-maxHp gear
and back, and would make removing a maxHp item devastating (an instant
drop to the new, lower max) rather than proportional.
Rescaling keeps a
gear change feel proportionate in both directions without ever creating or
destroying resource "for free," and the HP floor of 1 keeps the change
itself from being a death.

**Verification Description**
A unit or integration test equips an item that raises maxHp while the
character is below full HP, and asserts the new `currentHp` equals
`round(oldCurrentHp * newMaxHp / oldMaxHp)`, clamped into
`[1, newMaxHp]` — and symmetrically for unequip lowering maxHp/maxMp.

## Relations

**Realizes**

- [SYS-001](SYS-001-equip-gear-to-change-combat-stats.md)

**Related**

- [SW-004](SW-004-effective-stats-stack-race-base-with-gear-additively.md) — the stat computation this rescale is derived from
