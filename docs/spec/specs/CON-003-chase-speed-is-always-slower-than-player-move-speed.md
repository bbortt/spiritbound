**Title**
CHASE_SPEED must always be strictly less than the player's effective move speed

**Lens**: CON

**Status**: active

**Description**
`CHASE_SPEED` (110px/s) must remain strictly less than a player
character's effective move speed (base 180px/s, per `docs/BALANCE.md`,
scaled by `RACE_BASE.moveSpeed` and any gear/card modifiers) at all times
— this is not merely the current seeded values' relationship, it is an
invariant the constant must continue to satisfy through any future
retuning of either side.

**Rationale**
"A chase is always something you can walk away from, if you choose to" is
a stated design pillar (`site/mechanics.md`).
This constant inequality is
what makes that literally, mechanically true rather than usually true —
if it were ever violated, chases would become unescapable, contradicting
the pillar outright.

**Verification Description**
Reviewed whenever either `CHASE_SPEED` (`spacetimedb/src/index.ts`) or the
player's effective move speed changes: confirm the inequality still
holds.
No automated cross-module test currently enforces this (move speed
is computed client-side for rendering and server-side via
`buildEffectiveStats`, while `CHASE_SPEED` is a server-only constant) —
this remains a manual review gate, the same kind of deferral as the
`effectiveStats.ts` client-duplication ADR's verification approach, until
a shared constants module makes it checkable automatically.

## Relations

**Realizes**

- [SYS-003](SYS-003-enemies-aggro-chase-and-attack-under-server-authority.md)
