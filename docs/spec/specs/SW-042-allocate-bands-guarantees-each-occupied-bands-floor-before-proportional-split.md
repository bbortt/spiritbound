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
receives at least `cfg.floorPerOccupiedBand` — the outlier is never
starved — and that the remainder after both floors are paid splits 19:1
between the two occupied bands.
A second case asserts an occupied band never lands on zero however thin
its share.

**That scenario is run at `maxBandSharePct: 1`** (the maximum content
validation allows), which takes `SW-043`'s cap out of the way.
The cap is applied after this pass and at any share below 1.0 would cut
band 0 back before the output is observed, so asserting the 19:1 split in
a capped configuration would be asserting something the pipeline is
designed not to produce.
The floor guarantee holds in both configurations; only the proportion
needs the cap lifted to be visible.

## Relations

**Realizes**

- [SYS-013](SYS-013-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)

**Related**

- [SW-043](SW-043-allocate-bands-caps-a-band-at-its-share-and-redistributes-the-overflow.md) — the cap this floor-then-proportional split is then subject to

## Changes

- **2026-09-10** — Said explicitly that the 19-vs-1 scenario is asserted
  with the band-share cap lifted, and separated the floor guarantee (which
  holds unconditionally) from the proportion (which does not).
  As written the scenario was unsatisfiable at the shipped config: `SW-043`
  caps band 0 at `floor(budget * maxBandSharePct)` after this pass, so at
  any share below 1.0 the final allocation cannot be proportional to a 19:1
  demand — the spec was asking a verification to prove the pipeline broken.
  The floor guarantee is what the outlier case actually protects, and it
  survives the cap.

- **2026-09-08** — Set active: implementation of STR-012 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
