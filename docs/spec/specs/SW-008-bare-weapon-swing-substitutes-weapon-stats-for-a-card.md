**Title**
A bare weapon swing (cardDefId 0) substitutes weaponDamage and the equipped weapon's school/geometry for a card

**Lens**: SW

**Status**: active

**Description**
`damageEnemy` treats `cardDefId === 0` as a bare weapon swing (right-click
basic attack, no card cast): `cardBasePower` becomes the attacker's
effective `weaponDamage` stat (0 if unarmed), `cardSchool` becomes the
equipped main-hand weapon's `weaponSchool` (defaulting to `physical` if
bare-handed), and `cardBaseShape` becomes the weapon's `geometryShape`
(defaulting to `cone` if bare-handed) — `weaponWidth`/`weaponRange`
likewise default to `0.4`/`150` when unarmed.
The result is fed through
the identical `resolveHit` pipeline (`SW-007`) as a real card cast;
there is no second damage-resolution path.

**Rationale**
`resolveHit` never otherwise reads `weaponDamage` (card casts scale off
`physicalAttack`/`magicAttack` only, per `docs/GAME_DESIGN.md`'s stat
table) — without this substitution `weaponDamage` would be a dead stat on
every weapon in `equipment.json`.
Reusing `resolveHit` rather than adding
a parallel formula keeps the "server is sole damage authority" boundary
(`ARCH-003`) to one code path.

**Verification Description**
A test constructs the `resolveHit` input the way `damageEnemy` does for
`cardDefId === 0`, asserting `cardBasePower` comes from
`attackerStats.weaponDamage` and `cardSchool`/`cardBaseShape` come from the
equipped weapon's definition — and that a bare-handed attacker (no
main-hand item) falls back to `physical`/`cone`/`0.4`/`150`.

## Relations

**Realizes**

- [SYS-002](SYS-002-server-resolves-damage-client-only-confirms-geometry.md)

**Related**

- [SW-007](SW-007-resolve-hit-combines-scaling-mitigation-and-crit-into-one-damage-number.md)
