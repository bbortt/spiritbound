**Title**
allocateBands corrects rounding drift onto the largest band

**Lens**: SW

**Status**: planned

**Description**
After the floor, proportional-split, and cap/redistribution passes, if
the sum of all band allocations does not exactly equal `totalBudget`
(due to integer rounding in the proportional split), the difference is
added to or subtracted from whichever band currently holds the largest
allocation, so the final output always sums to exactly `totalBudget`.

**Rationale**
Proportional splitting of an integer budget across several bands will
generically not divide evenly; silently letting the total drift means the
zone's actual enemy count slowly diverges from its intended budget over
many ticks.
Correcting on the largest band is the least visible place to
absorb a one- or two-count adjustment, since it changes that band's total
by the smallest relative fraction.

**Verification Description**
A property test runs `allocateBands` over many randomized demand vectors
and budgets and asserts the output array always sums to exactly the input
`totalBudget`, with no case relying on the split happening to divide
evenly.

## Relations

**Realizes**

- [SYS-013](SYS-013-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)
