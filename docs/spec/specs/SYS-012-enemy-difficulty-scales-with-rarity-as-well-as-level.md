**Title**
Enemy difficulty scales with rarity as well as level

**Lens**: SYS

**Status**: planned

**Description**
An enemy's combat stats (HP, damage) and the rarity floor of its drop
table both scale with a rarity assigned to that enemy, independent of and
in addition to its level.
A rare or epic enemy is a materially harder
fight with materially better odds than a common enemy of the same level.

**Rationale**
Level alone already conveys "this fight is bigger"; rarity is the second,
independent axis that conveys "this fight is special" — a signal the
spawn director and boss cycle in this increment both depend on to make a
rare spawn or a zone boss feel distinct rather than merely numerically
larger. `docs/BALANCE.md` names flat, rarity-blind enemy stats as the
last remaining placeholder after `CON-007` retired flat XP.

**Verification Description**
Reviewed via the SW/CON specs this realizes, each independently
verifiable by unit test.

## Relations

**Related**

- [STR-011](../stories/STR-011-enemy-rarity-scales-hp-damage-and-drop-tables.md) — the story delivering this capability
- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md) — the sibling level-scaling capability this extends with a second axis
