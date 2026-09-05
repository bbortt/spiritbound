**Title**
Equipping an item requires character ownership and an exact slot-tag match

**Lens**: SW

**Status**: active

**Description**
The `equipItem` reducer rejects the call unless: the calling identity has
an active character, the referenced `itemInstance` exists and its
`ownerCharacterId` is that character, and the instance's `itemDefinition`
has a non-null `slot` matching the requested `slot` tag exactly.
Any
violation throws a `SenderError` and no table is mutated.

**Rationale**
Items are permadeath-relevant, account-facing state; without an ownership
check a client could equip another character's item, and without the
slot-tag check an off-hand focus could be forced into the main-hand slot.
Both are trust-boundary violations the server (not the client) must be the
one to reject.

**Verification Description**
A unit or integration test calling `equipItem` with (a) an instance owned
by a different character, (b) a nonexistent instance id, and (c) an
instance whose definition's slot does not match the requested slot, each
expects a thrown `SenderError` and no `equippedItem` row inserted.

## Relations

**Realizes**

- [SYS-001](SYS-001-equip-gear-to-change-combat-stats.md)
