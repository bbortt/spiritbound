**Title**
allocateBands caps a band at its configured share and redistributes the overflow

**Lens**: SW

**Status**: active

**Description**
After the floor-then-proportional pass, any band whose allocation exceeds
`floor(totalBudget * cfg.maxBandSharePct)` is capped at that value, and
the overflow (the amount cut) is redistributed to the other occupied
bands that are not themselves already at their cap.

**The cap is a guarantee only while two or more bands are occupied** —
that is the case it exists to protect, and there it is absolute.
With a single occupied band there is no other occupied band to protect,
and the overflow instead falls through to the unoccupied bands that still
have headroom; a resting band is where an ambient population belongs.
If every band in the zone is already at its cap, the residue is left to
`SW-044`'s drift correction, which places it on the largest band — the one
case where a band may end up a count or two above its share.
`SW-044`'s "sums to exactly `totalBudget`" is the stronger invariant and
wins the tie, because a budget that silently evaporates is a worse failure
than a share that is briefly exceeded in a zone nobody is standing in.

**Rationale**
Without a per-band cap, a single band with an overwhelming majority of
players could consume the zone's entire population budget, leaving every
other occupied band — even one with real players in it — at its bare
floor forever.
The cap keeps population spread across active areas of the
zone instead of collapsing entirely onto wherever the crowd currently is.

**Verification Description**
A unit test with a single occupied band and several unoccupied ones
asserts that band is capped at `floor(budget * maxBandSharePct)`, does not
consume the full budget, and that the cut lands on the unoccupied bands
rather than being discarded — the allocation still sums to the budget.
A unit test with one dominant occupied band and two minor occupied bands
asserts the dominant band's overflow lands on the two minor bands.

## Relations

**Realizes**

- [SYS-013](SYS-013-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)

**Related**

- [SW-042](SW-042-allocate-bands-guarantees-each-occupied-bands-floor-before-proportional-split.md) — the allocation this cap is applied on top of
- [SW-044](SW-044-allocate-bands-corrects-rounding-drift-onto-the-largest-band.md) — the invariant this one yields to

## Changes

- **2026-09-10** — Scoped the cap's guarantee to zones with two or more
  occupied bands, and replaced "the overflow is held rather than assigned
  anywhere" with the fall-through to unoccupied bands.
  As written, this spec and `SW-044` were mutually unsatisfiable: holding
  the overflow means the allocation no longer sums to `totalBudget`, which
  `SW-044` requires, so with a single occupied band the two rules cycled and
  the cap did nothing.
  This spec yields because its purpose — stopping one crowd from starving
  another occupied band — has no subject when only one band is occupied,
  whereas a budget that fails to sum is wrong in every case.
- **2026-09-08** — Set active: implementation of STR-012 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
