**Title**
Attuning past a rarity's slot budget is rejected; un-attuning is never rejected

**Lens**: SW

**Status**: active

**Description**
`toggleAttune` only checks the rarity slot budget when the toggle is
turning attunement ON: it counts the character's other currently-attuned
cards of the same rarity (excluding the card being toggled) and rejects
with a `SenderError` if that count already meets or exceeds
`computeAttunementSlots`'s budget for that rarity at the account's current
spirit level.
Toggling an already-attuned card OFF is never rejected for
any reason.

**Rationale**
The budget is a live, re-checked-every-toggle constraint (not enforced
once at attune-time and forgotten), which matters because a spirit-level
change could otherwise leave a stale over-attune uncaught until death (see
`computeRetention`'s own over-attune guard, `SW-022`).
Allowing
unlimited un-attuning keeps the player always able to free up budget
without a separate "unlock" step.

**Verification Description**
A unit test attunes cards up to a rarity's exact slot cap, asserts the
next attune attempt at that rarity throws, and asserts un-attuning any
already-attuned card always succeeds regardless of current counts.

## Relations

**Realizes**

- [SYS-006](SYS-006-death-destroys-gear-and-un-attuned-cards-keeps-only-what-was-attuned.md)

**Related**

- [SW-023](SW-023-attunement-slots-per-rarity-grow-with-spirit-level-legendary-gated-at-thirty.md)
