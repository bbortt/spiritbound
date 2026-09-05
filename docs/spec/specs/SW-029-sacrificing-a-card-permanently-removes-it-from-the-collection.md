**Title**
Sacrificing a card permanently removes it from the collection

**Lens**: SW

**Status**: active

**Description**
`sacrificeCard` deletes the target `cardInstance` outright (permanently —
not moved to any recovery state) as part of the same reducer call that
grants the spirit its bond XP; a card cannot be sacrificed by anyone
other than its owning identity.

**Rationale**
From the Hand-management surface, this is the collection's own "delete
forever" action, distinct from death's involuntary card loss — the value
it destroys is exactly what makes the resulting bond-XP grant feel like a
real tradeoff (see [STR-006](../stories/STR-006-death-and-retention.md)
for the XP curve itself).

**Verification Description**
A unit test asserts the card row no longer exists after the call, and
that a non-owner's sacrifice attempt is rejected.

## Relations

**Realizes**

- [SYS-007](SYS-007-the-hand-is-a-spirit-level-gated-card-loadout.md)

**Related**

- [SW-024](SW-024-spirit-level-is-a-log-shaped-curve-over-bond-xp.md) — the spirit bond-XP curve this action feeds
