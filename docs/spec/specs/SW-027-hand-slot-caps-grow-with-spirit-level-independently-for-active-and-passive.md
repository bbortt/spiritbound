**Title**
Hand slot caps grow with spirit level, independently for active and passive cards

**Lens**: SW

**Status**: active

**Description**
`computeHandSlots(spiritLevel)` returns `active: min(10, 2 + floor(level *
0.2))` and `passive: min(5, 1 + floor(level * 0.1))` — two independent
caps (2/1 at spirit level 1, capping at 10/5 around spirit level 40),
gated on SPIRIT level, never character level.

**Rationale**
Ties build-crafting capacity to the permanent, death-surviving spirit
progression track rather than the per-life character level, so a fresh
life after death doesn't also shrink how many cards a player can wield.

**Verification Description**
A unit test sweeps `spiritLevel` and asserts both caps at low/mid/capped
values, and that the two types never share or interact with each other's
budget.

## Relations

**Realizes**

- [SYS-007](SYS-007-the-hand-is-a-spirit-level-gated-card-loadout.md)
