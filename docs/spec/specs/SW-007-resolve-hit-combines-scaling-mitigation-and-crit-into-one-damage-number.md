**Title**
resolveHit combines level scaling, school-matched attack bonus, flat defense, capped glancing avoidance, and crit into one damage number

**Lens**: SW

**Status**: active

**Description**
`resolveHit` computes final damage in a fixed order: (1) scale the card's
`basePower` by `1 + characterLevel * 0.05` (`scalePower`); (2) add the
attacker's `physicalAttack` or `magicAttack` — but only when `cardSchool
=== weaponSchool` (a caster swinging a sword still casts the card, but
gets no weapon bonus — the "soft lock" that rewards school/weapon
synergy without hard-locking cards to weapon types); (3) subtract the
defender's flat `physicalDef`/`magicDef`, floored at `MIN_DAMAGE`; (4)
apply glancing avoidance — `rawAvoidance` is `(evasion + parry) / 2` for a
physical hit or `magicResist` for a magical one, reduced by the attacker's
`accuracy`/`magicAccuracy` at a fixed `0.002`-per-point rate, floored at 0,
then capped at `MAX_GLANCING_REDUCTION` (see `CON-002`) and applied as
a multiplicative reduction; (5) roll a crit (`randomRoll < physicalCrit`
or `< magicCrit`) and multiply by `CRIT_MULTIPLIER` (1.5) if it lands,
then round and floor at `MIN_DAMAGE` again (see `CON-001`).

**Rationale**
This ordering is the whole "hitting is skill, mitigation is stats" pillar
made concrete: the client already decided _whether_ the attack connects
(aim, weapon geometry), and every step here is server-side stat math with
no further randomness except the single crit roll, which the caller
(a reducer) supplies deterministically via `ctx.random()`.

**Verification Description**
`spacetimedb/src/rules/combat.test.ts` (new) calls `resolveHit` with fixed
inputs and asserts: a school-matched hit includes the attack-stat bonus, a
school-mismatched hit does not; a `randomRoll` below the crit chance
multiplies by 1.5, one above does not; the exact numeric result for at
least one fully-specified case (given power/level/stats, the expected
integer damage).

## Relations

**Realizes**

- [SYS-002](SYS-002-server-resolves-damage-client-only-confirms-geometry.md)

**Related**

- [CON-001](CON-001-damage-never-resolves-below-min-damage.md)
- [CON-002](CON-002-glancing-avoidance-caps-at-twenty-percent-reduction.md)
- [SW-008](SW-008-bare-weapon-swing-substitutes-weapon-stats-for-a-card.md) — the same pipeline invoked without a card
