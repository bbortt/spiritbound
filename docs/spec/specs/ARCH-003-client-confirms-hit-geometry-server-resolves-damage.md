**Title**
The client confirms hit geometry; the server is sole authority on the resulting damage

**Lens**: ARCH

**Status**: active

**Description**
The client determines only whether an attack geometrically connects
(cursor aim vs. weapon shape vs. target position) and tells the server
which target and card (if any) it hit with.
The server — via
`resolveHit`/`_resolveAndApplyDamage` — is the sole authority on how much
damage that connection becomes, and the only thing that ever writes
`currentHp`.
The client never supplies, and the server never trusts, a
client-computed damage number.

**Rationale**
Matches the design pillar "hitting is skill, mitigation is stats": aim is
naturally cheap and immediate to check client-side, but trusting the
client with the damage number itself would make the server
non-authoritative over a permadeath-relevant value.
Costs one extra
round-trip per landed hit (client confirms geometry → server resolves
damage) versus a fully client-authoritative model — an accepted tradeoff.

**Verification Description**
Reviewed by confirming every `currentHp`-writing path
(`_resolveAndApplyDamage`, called from `damageEnemy`, `applyDamage`, and
`_fireCast`) routes through `resolveHit` with server-computed
`attackerStats`/`defenderStats`, never a client-supplied damage number.

## Relations

**Related**

- [STR-002](../stories/STR-002-combat-resolution.md)
- [SW-007](SW-007-resolve-hit-combines-scaling-mitigation-and-crit-into-one-damage-number.md)
