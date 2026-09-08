**Title**
allocateBands guarantees each occupied band's floor before splitting the remainder proportionally

**Lens**: SW

**Status**: active

**Description**
`allocateBands(totalBudget, demand, bandCount, cfg)` first gives every
band with `playerCount > 0` ("occupied") `cfg.floorPerOccupiedBand`, then
distributes whatever budget remains across those same occupied bands
proportional to each band's share of total player count.
Unoccupied bands
receive 0 at this stage (before the cap/redistribution and rounding-drift
passes in the sibling specs below are applied).

**Rationale**
A pure proportional split alone would starve a lightly-populated band
entirely if another band vastly outweighs it in player count — the
lone-outlier case (19 players in one band, 1 in another) must still give
the outlier's band a meaningful presence, not zero.
Guaranteeing the
floor first, then splitting only the remainder, is what makes that true
regardless of how skewed demand is.

**Verification Description**
A unit test with 19 players in band 0 and 1 player in band 4 (5 bands
total, budget well above `floorPerOccupiedBand * 2`) asserts band 4
receives at least `cfg.floorPerOccupiedBand`, and that the remaining
budget after both floors are paid is split between the two occupied bands
proportional to their 19:1 player share.

## Relations

**Realizes**

- [SYS-013](SYS-013-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)

**Related**

- [SW-043](SW-043-allocate-bands-caps-a-band-at-its-share-and-redistributes-the-overflow.md) — the cap this floor-then-proportional split is then subject to

## Changes

- **2026-09-08** — Set active: implementation of STR-012 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
