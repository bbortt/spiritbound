**Title**
computeRetention keeps only attuned cards, each consuming one slot of its own rarity tier

**Lens**: SW

**Status**: active

**Description**
`computeRetention` partitions a character's cards into attuned and
un-attuned; every un-attuned card is unconditionally lost.
Each attuned
card consumes one slot of its own rarity tier from the
`computeAttunementSlots` budget (processed in whatever order the caller
passes them — no priority or sorting by value); if more cards of a rarity
are attuned than that tier has slots for (an over-attune the UI should
have prevented, but the server still guards it, e.g. after a spirit-level
drop), the excess is lost as a fail-safe rather than trusted.

**Rationale**
"No random rolls, no save-or-lose — just a decision you made ahead of
time" (`site/mechanics.md`) — retention must be fully deterministic from
the attune decision and the slot budget, never RNG.

**Verification Description**
A unit test with more attuned commons than the common slot budget allows
asserts exactly the budgeted count survive and the rest are lost; a test
with un-attuned cards present asserts they're always in the lost set
regardless of rarity or slot availability.

## Relations

**Realizes**

- [SYS-006](SYS-006-death-destroys-gear-and-un-attuned-cards-keeps-only-what-was-attuned.md)
