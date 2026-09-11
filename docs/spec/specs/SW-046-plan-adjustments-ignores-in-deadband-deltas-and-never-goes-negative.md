**Title**
planAdjustments ignores in-deadband deltas and never emits a negative count

**Lens**: SW

**Status**: active

**Description**
`planAdjustments(target, actual, cfg)` computes `delta = target - actual`
per band.
A band whose `|delta| <= cfg.deadband` produces no spawn or
despawn action at all — including when `|delta|` is exactly equal to the
deadband, not only strictly less.

A band that clears the deadband emits **the full `|delta|`**, not
`|delta| - cfg.deadband`: the deadband decides _whether_ to act, never
_how much_ to act by.
No spawn or despawn count this function returns is ever negative.

**Rationale**
A deadband exists specifically to stop the director reacting to
population noise that is within its own tolerance — treating the boundary
value itself as "still noise" (`<=`, not `<`) is what actually prevents
oscillation right at the configured threshold; a `<` boundary would let a
delta sitting exactly on the deadband still trigger an action every tick.

Emitting the full delta rather than the delta minus the deadband is what
keeps the deadband a dead zone instead of a permanent under-correction.
Subtracting it would leave every band that acts still short of its target
by the deadband width, so the director would chase a moving goal it can
never reach and the shortfall would compound across ticks.

**Verification Description**
A unit test asserts a band with `delta` equal to `cfg.deadband` produces
no action, one strictly greater produces a spawn count equal to the full
`delta` (not `delta - deadband`), one strictly more negative than
`-cfg.deadband` produces a despawn count equal to the full `|delta|`, and
a property test sweeping random targets/actuals never returns a negative
spawn or despawn count for any band.

## Relations

**Realizes**

- [SYS-013](SYS-013-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)

## Changes

- **2026-09-10** — Specified that a band clearing the deadband emits the
  full `delta`, not `delta - deadband`.
  The spec was silent on the magnitude and only constrained whether to act,
  which left the implementation's choice unspecced and the alternative
  reading available to the next reader.
  The full delta is correct: subtracting the deadband would turn a dead
  zone into a permanent under-correction that compounds every tick.
- **2026-09-08** — Set active: implementation of STR-012 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
