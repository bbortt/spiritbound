**Title**
Equipping an item enforces the item definition's minimum character level

**Lens**: SW

**Status**: active

**Description**
The `equipItem` reducer rejects the call with a `SenderError` when the
referenced item definition's `minLevel` exceeds the calling character's own
level, naming both the requirement and the character's level.
The check runs after ownership and slot-tag validation
([SW-001](SW-001-equip-requires-ownership-and-matching-slot.md)) and
before any table is mutated: a rejected call inserts no `equippedItem` row
and deletes no existing occupant of the targeted slot.

The inventory panel mirrors the gate rather than letting the click reach a
reducer that will refuse it: an item the character cannot yet equip offers no
equip action and states the level it requires, the way the collection panel
already mirrors the card gate.

**Rationale**
Gear drops are gated on the _enemy's_ level plus headroom, never the killer's
([SW-037](SW-037-drop-eligibility-filters-to-the-enemys-level-plus-two.md)),
and pickup is a proximity check with no level condition.
Hollow Vale admits level-one characters and spawns bands up to level ten plus a
level-ten boss, so a level-one character can reach, loot and carry an item
whose definition is ten levels above it.
Without a gate on equip, `minLevel` is decoration: the item's stats apply in
full the moment it is equipped, and the intended progression from a starting
kit to a full set across the first ten levels collapses into one lucky drop.

Cards already work this way
([SW-028](SW-028-equip-card-enforces-level-gate-and-hand-slot-cap-replacing-only-the-exact-slot.md)),
and the asymmetry is the bug rather than a design choice — the item path simply
never grew the check, which went unnoticed while every shipped item was
`minLevel: 1`.

The server is the one that must reject it.
The client mirror exists so the player learns the requirement from the item
rather than from a silent failure, and carries no authority of its own.

**Verification Description**
A test calls `equipItem` for an item whose definition's `minLevel` exceeds the
character's level and asserts a thrown `SenderError` naming the required level,
with no `equippedItem` row written for that character.
The same call then runs at exactly the item's `minLevel` and asserts it
succeeds, fixing the boundary as inclusive.
That a rejection also leaves an existing occupant of the targeted slot equipped
is not asserted separately: the gate throws ahead of the block performing every
write, so no mutation is reachable once it fires.
The client mirror is verified at its decision, not through the DOM: a unit test
asserts the inventory click resolves to no action for an under-level item,
naming the level it requires, and that the same item still resolves to an
unequip when it is already worn.
The panel derives the locked state it renders from that same decision rather
than re-deriving the comparison, so a cell cannot disagree with the click.

## Relations

**Realizes**

- [SYS-001](SYS-001-equip-gear-to-change-combat-stats.md)

**Related**

- [SW-001](SW-001-equip-requires-ownership-and-matching-slot.md) —
  the ownership and slot gate this check follows
- [SW-002](SW-002-equip-auto-replaces-same-slot-ordinal-occupant.md) —
  the same-slot replacement a rejected equip must not perform
- [SW-006](SW-006-inventory-click-picks-first-empty-dual-slot-ordinal.md) —
  the inventory click this gate suppresses before it picks an ordinal
- [SW-028](SW-028-equip-card-enforces-level-gate-and-hand-slot-cap-replacing-only-the-exact-slot.md) —
  the card-side gate this mirrors for items
- [SW-037](SW-037-drop-eligibility-filters-to-the-enemys-level-plus-two.md) —
  the drop rule that makes an over-level item reachable in the first place
