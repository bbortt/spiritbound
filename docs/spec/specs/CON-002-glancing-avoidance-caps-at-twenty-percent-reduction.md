**Title**
Glancing avoidance caps at 20% damage reduction and can never fully negate a hit

**Lens**: CON

**Status**: active

**Description**
The glancing-avoidance fraction — derived from the defender's
evasion/parry (physical) or magicResist (magical), reduced by the
attacker's accuracy/magicAccuracy at a fixed `0.002`-per-point rate — is
clamped to `MAX_GLANCING_REDUCTION` (0.20) before being applied as a
multiplicative reduction in `resolveHit`.
No combination of defensive
stats can reduce a connected hit's damage by more than 20% through this
channel, and this channel alone can never reach full negation.

**Rationale**
Explicit design decision (stated in `combat.ts`'s own constant comment):
evasion/parry/magic-resist represent a glancing blow, not a dodge — full
negation would let a sufficiently stacked defensive build become
literally unhittable, a "feel-bad" outcome for a permadeath game where
the attacker's aim already succeeded.

**Verification Description**
A test sets defender avoidance stats far above anything the attacker's
accuracy could counter and asserts the computed `glancingFraction` equals
exactly `0.20`, never higher, and that the resulting damage is still
governed by `CON-001`'s floor.

## Relations

**Realizes**

- [SYS-002](SYS-002-server-resolves-damage-client-only-confirms-geometry.md)

**Related**

- [SW-007](SW-007-resolve-hit-combines-scaling-mitigation-and-crit-into-one-damage-number.md)
- [CON-001](CON-001-damage-never-resolves-below-min-damage.md)
