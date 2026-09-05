**Title**
equipCard enforces the character level gate and hand-slot cap, replacing only an exact slot match

**Lens**: SW

**Status**: active

**Description**
`equipCard` rejects (via `SenderError`) if: the card isn't owned by the
caller, the card definition's `minCharacterLevel` exceeds the character's
own level, or — only when no card already occupies the exact `(slotType,
slotIndex)` pair being targeted — the hand already holds
`computeHandSlots`'s cap for that type.
If a card already occupies that
exact slot+index, it's replaced in place (deleted then re-inserted)
regardless of the cap, since the total count doesn't change.

**Rationale**
The level gate keeps a low-level character from wielding cards past its
own combat-stat curve even if the Hand has room.
The exact-slot-replace-
bypasses-cap behavior mirrors the Equipment system's identical same-slot
swap rule ([SW-002](SW-002-equip-auto-replaces-same-slot-ordinal-occupant.md))
for a consistent "swapping never needs a separate unequip step" feel.

**Verification Description**
A unit test with a full active hand asserts equipping into a new slot
index is rejected while equipping into an already-occupied index still
succeeds; a test with a card whose `minCharacterLevel` exceeds the
character's level asserts rejection regardless of hand-slot availability.

## Relations

**Realizes**

- [SYS-007](SYS-007-the-hand-is-a-spirit-level-gated-card-loadout.md)

**Related**

- [SW-002](SW-002-equip-auto-replaces-same-slot-ordinal-occupant.md)
