**Title**
resolveHeal scales power by level and healingBoost, with no crit or mitigation

**Lens**: SW

**Status**: active

**Description**
`resolveHeal` computes `round(max(1, (scalePower(basePower, level) +
healerStats.magicAttack) * healerStats.healingBoost))` — the same
level-scaling formula `resolveHit` uses (`scalePower`), plus the healer's
`magicAttack`, multiplied by `healingBoost`.
There is no crit roll and no
mitigation step: healing is never resisted, evaded, or critically
amplified by the target.

**Rationale**
Healing is a support action performed on a willing target, not a
contested roll between two combatants — there is no defensive stat on the
receiving end for it to interact with, so the formula is deliberately
simpler than `resolveHit`'s.

**Verification Description**
`spacetimedb/src/rules/combat.test.ts` asserts the exact formula for given
`basePower`/`characterLevel`/`healerStats` inputs, and that the output
floors at 1 even for a healer with near-zero stats and a near-zero base
power.

## Relations

**Realizes**

- [SYS-002](SYS-002-server-resolves-damage-client-only-confirms-geometry.md)

**Related**

- [SW-007](SW-007-resolve-hit-combines-scaling-mitigation-and-crit-into-one-damage-number.md) — shares `scalePower`
