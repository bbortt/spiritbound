**Title**
planAdjustments ignores in-deadband deltas and never emits a negative count

**Lens**: SW

**Status**: planned

**Description**
`planAdjustments(target, actual, cfg)` computes `delta = target - actual`
per band.
A band whose `|delta| <= cfg.deadband` produces no spawn or
despawn action at all — including when `|delta|` is exactly equal to the
deadband, not only strictly less.
No spawn or despawn count this function
returns is ever negative.

**Rationale**
A deadband exists specifically to stop the director reacting to
population noise that is within its own tolerance — treating the boundary
value itself as "still noise" (`<=`, not `<`) is what actually prevents
oscillation right at the configured threshold; a `<` boundary would let a
delta sitting exactly on the deadband still trigger an action every tick.

**Verification Description**
A unit test asserts a band with `delta` equal to `cfg.deadband` produces
no action, one strictly greater produces the expected spawn, one strictly
more negative than `-cfg.deadband` produces the expected despawn, and a
property test sweeping random targets/actuals never returns a negative
spawn or despawn count for any band.

## Relations

**Realizes**

- [SYS-013](SYS-013-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)
