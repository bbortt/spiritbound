**Title**
Death always destroys equipped gear outright; an account with no personal spirit loses every card

**Lens**: SW

**Status**: active

**Description**
`_handleDeath` unconditionally deletes every `equippedItem` and
`itemInstance` row for the dying character — no attunement, no exceptions
— before it even looks at cards.
If the account has no `personalSpirit`
row at all, every `cardInstance` the account owns is deleted regardless of
its `attuned` flag (attunement is meaningless without a spirit to hold it)
— only when a spirit exists does `computeRetention` run at all.

**Rationale**
Gear's unconditional loss is the stated permanent economy sink with
literally no insurance path, by design ("gear is your body," no
exceptions).
The no-spirit case is a fail-safe for an edge case (an
account somehow without its personal spirit) rather than a normal path,
but must still resolve deterministically rather than error.

**Verification Description**
A unit test kills a character with equipped gear and asserts zero
`equippedItem`/`itemInstance` rows remain regardless of any
attunement-like state; a test kills a character whose account has no
`personalSpirit` row and asserts every card (attuned or not) is gone
afterward.

## Relations

**Realizes**

- [SYS-006](SYS-006-death-destroys-gear-and-un-attuned-cards-keeps-only-what-was-attuned.md)
