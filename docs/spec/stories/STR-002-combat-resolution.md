**Title**
Combat resolution — server-authoritative damage and healing math

**Status**: active

**Business Value**
Combat resolution is the mechanical core of "hitting is skill, mitigation
is stats" (`CLAUDE.md`): the client's cursor-aimed geometry decides whether
an attack connects, but the server alone decides how much that connection
costs.
This is what makes permadeath fair — a client can never inflate its
own damage output, and every character's defensive stats mean something
identical regardless of who is attacking them.

**Problem / Context**
This is a retrofit story: `resolveHit`/`resolveHeal` and the bare-weapon-swing
path already shipped and are live in the codebase, with no spec recording
what they do and no unit tests at all (`spacetimedb/src/rules/combat.ts`
has no `combat.test.ts` sibling today).
Nothing currently catches a future
regression here (a mitigation formula change, a floor removed) as a spec
violation rather than a silent behavior change.

**Solution Approach**
Author SW specs for resolveHit's damage pipeline, resolveHeal, and the
bare-weapon-swing substitution; CON specs for the two hard invariants
(the damage floor, the glancing-avoidance cap); one ARCH spec restating
the client-geometry/server-damage trust boundary.
Create
`spacetimedb/src/rules/combat.test.ts` (does not exist yet) covering every
SW/CON spec below, since `resolveHit`/`resolveHeal` are already pure
functions (randomness passed in as `randomRoll`) with nothing blocking a
unit test today.

**Acceptance Criteria**

- Every spec below is anchored to `spacetimedb/src/rules/combat.ts`.
- A new `spacetimedb/src/rules/combat.test.ts` exists and its cases anchor
  back to the SW/CON specs they verify.
- `clew coverage` shows every spec in this story as Covered.
- No existing damage/healing behavior changed — this is a
  documentation-and-test retrofit, not a feature change.

**Out of scope**

- Enemy AI's telegraph/aggro/cast timing — covered by the Enemy AI story;
  this story is only the `resolveHit`/`resolveHeal` math itself and the
  invariants it must hold, not who calls it or when.
- Gear's contribution to `attackerStats`/`defenderStats` — that
  computation is the Equipment story's; this story treats a `StatBlock` as
  a given input.

## Relations

**Realizes**

- [SYS-002](../specs/SYS-002-server-resolves-damage-client-only-confirms-geometry.md) — the system-level capability
- [SW-007](../specs/SW-007-resolve-hit-combines-scaling-mitigation-and-crit-into-one-damage-number.md)
- [SW-008](../specs/SW-008-bare-weapon-swing-substitutes-weapon-stats-for-a-card.md)
- [SW-009](../specs/SW-009-resolve-heal-scales-power-by-level-and-healing-boost.md)
- [CON-001](../specs/CON-001-damage-never-resolves-below-min-damage.md)
- [CON-002](../specs/CON-002-glancing-avoidance-caps-at-twenty-percent-reduction.md)
- [ARCH-003](../specs/ARCH-003-client-confirms-hit-geometry-server-resolves-damage.md)
