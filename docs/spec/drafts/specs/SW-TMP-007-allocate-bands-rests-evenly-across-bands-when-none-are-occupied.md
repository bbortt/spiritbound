**Title**
allocateBands rests evenly across all bands when none are occupied

**Lens**: SW

**Status**: planned

**Description**
When no band has any players (`demand` is all zero), `allocateBands`
returns the total budget spread as evenly as possible across every band
(not just occupied ones) — never an all-zero array.

**Rationale**
An empty zone is not the same as a zone that should hold no enemies: the
map is meant to keep a baseline population so it never reads as
completely dead when the first player arrives.
This is the one case in
the module where zero demand deliberately does not mean zero output —
worth its own spec because it is counter-intuitive next to every other
rule here, which all reduce allocation toward zero as demand thins.

**Verification Description**
A unit test with a demand vector of all zeros asserts every band receives
a non-zero share of the budget, the shares are as even as the budget and
band count allow, and the total still sums to exactly `totalBudget`.

## Relations

**Realizes**

- [SYS-TMP-002](SYS-TMP-002-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)
