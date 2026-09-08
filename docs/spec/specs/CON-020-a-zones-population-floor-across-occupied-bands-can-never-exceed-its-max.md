**Title**
A zone's population floor across occupied bands can never exceed its max

**Lens**: CON

**Status**: planned

**Description**
A zone's `population` config must satisfy `population.min <= population.max`,
and `population.floorPerOccupiedBand * levelBands.length <= population.max`.
Violating either is rejected; the second rejection's error message names
both the computed floor total (`floorPerOccupiedBand * levelBands.length`)
and the configured `population.max`.

**Rationale**
The spawn director guarantees every occupied band `floorPerOccupiedBand`
population before distributing any remainder.
If every band's floor
already exceeds the zone's population ceiling, that guarantee is
unsatisfiable — the director would perpetually try to fill bands past the
budget it is also required to respect, thrashing between spawn and
despawn every tick with no stable point.
Naming both numbers in the error
turns a live-service outage into a one-line content fix.

**Verification Description**
`content/zones.test.ts` asserts the shipped `hollow-vale` config (floor 6
× 5 bands = 30 <= max 120) validates, that `population.min > population.max`
is rejected, and that a floor/band-count product exceeding `max` is
rejected with an error string containing both the computed product and
the configured max.

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)

**Related**

- [CON-019](CON-019-zone-level-bands-partition-the-zones-level-range-with-no-gap-or-overlap.md) — the band count this check multiplies against
