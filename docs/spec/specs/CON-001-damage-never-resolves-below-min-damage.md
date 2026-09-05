**Title**
Damage never resolves below MIN_DAMAGE, at every step where it could reach zero

**Lens**: CON

**Status**: active

**Description**
`resolveHit` floors its running damage value at `MIN_DAMAGE` (1) twice:
immediately after subtracting flat defense, and again after the final
crit/rounding step. `resolveHeal` floors its result at 1 as well.
No
combination of defense, avoidance, or healing inputs can produce a result
of 0 or less.

**Rationale**
A hit or heal that resolves to 0 would look and feel like a broken
interaction rather than a mitigated one, and would let a sufficiently
stacked defensive build become effectively invulnerable — a "feel-bad"
outcome the design explicitly avoids (see `CON-002`'s glancing cap,
which exists for the same reason).

**Verification Description**
A test with defense far exceeding raw damage (and, separately, with
`MAX_GLANCING_REDUCTION`-capped avoidance also applied) still asserts the
returned damage is `>= 1`; a healing test with near-zero inputs asserts
the returned heal is `>= 1`.

## Relations

**Realizes**

- [SYS-002](SYS-002-server-resolves-damage-client-only-confirms-geometry.md)

**Related**

- [SW-007](SW-007-resolve-hit-combines-scaling-mitigation-and-crit-into-one-damage-number.md)
- [CON-002](CON-002-glancing-avoidance-caps-at-twenty-percent-reduction.md)
