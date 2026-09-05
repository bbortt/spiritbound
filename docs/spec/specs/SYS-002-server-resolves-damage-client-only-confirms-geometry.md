**Title**
A landed hit's damage is always computed and applied server-side from the defender's real stats

**Lens**: SYS

**Status**: active

**Description**
Whenever an attack connects (confirmed by the client's cursor-aimed
geometry check), the amount of damage or healing that results is computed
entirely server-side from the attacker's and defender's real, currently
equipped stats — never from a number the client supplies.
The client's
only role in this pipeline is telling the server "this attack connected";
it has no way to influence how much that connection is worth.

**Rationale**
Per `docs/GAME_DESIGN.md` and the pillar "hitting is skill, mitigation is
stats," aim is a player skill (client-side, immediate) while the
consequence of a landed hit must be identical and trustworthy no matter
who is attacking — a permadeath game cannot let a modified or malicious
client kill another player's character with fabricated damage.

**Verification Description**
Reviewed via the SW/CON/ARCH specs this realizes, each independently
verifiable by test or manual review.

## Relations

**Related**

- [STR-002](../stories/STR-002-combat-resolution.md) — the story delivering this capability
