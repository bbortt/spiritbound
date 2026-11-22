**Title**
Each resource carries its own paid-up-to stamp, so a fractional rate needs no remainder column

**Lens**: SW

**Status**: active

**Description**
The regen stats are rates per **second** (0.5 HP/s, 0.3 MP/s), and
`currentHp`/`currentMp` are `i32`.
Two new `character` columns, `lastHpRegenAt` and `lastMpRegenAt`, record
the instant each resource has been paid up to.

For each resource, a tick computes its accrual window, grants
`floor(rate × windowSeconds)`, and advances that resource's stamp by
exactly `granted / rate` seconds — the time it just paid for — leaving the
sub-unit remainder sitting in the gap between the stamp and now.
So a 0.5 HP/s rate on a 1 s tick grants nothing on the first tick and 1 HP
on the second, forever, with no drift and no rounding loss.
A tick that can pay nothing — a rate of 0, or a resource with no headroom
because it is full or a gear change left it above its maximum — grants
nothing, leaves the stamp exactly where it was, and writes no row at all.

A tick that pays but is **cut short by the headroom** — it fills the resource
with window left over — discards that surplus and advances the stamp to now.
Carrying it would leave an idle character holding hours of redeemable regen
for whatever lowers the resource next.

Regen is still not bankable, but the tick is not what prevents it: **every
path that lowers a resource or re-bases its maximum restamps that resource's
clock** — damage resolution, the level-up refill, and the proportional gear
rescale.
Each of those already writes the character row, so the restamp is free, and
the tick stays silent on an idle server.
Had the tick instead reset the stamp of every full resource it saw, a server
with nobody fighting would write one row per character per second, which is
the subscription storm `SW-059` exists to avoid.

The windows differ, and that is the whole reason the stamps are separate:

- MP's window starts at `lastMpRegenAt`, always.
- HP's window starts at `max(lastHpRegenAt, lastCombatAt + outOfCombatSeconds)`,
  so during a fight the window start is in the future, the span is zero or
  negative, and the tick grants nothing — without any special case for
  "blocked", and without a backlog to settle when combat ends.

**Rationale**
The obvious implementations are all wrong in a way that shows up as a
balance bug rather than a crash.
`Math.round(0.5)` is 1, which silently doubles every rate at the base
values and makes `hpRegen` 0.4 and 0.5 identical.
`Math.floor` on a per-tick amount is 0 for every rate below one per tick,
so the whole feature does nothing and the stat stays dead.
A `hpRegenRemainder` float column would work, but it adds mutable state to
the hottest row in the schema to store something the clock already knows.
Advancing by the time actually paid for, rather than to `now`, is what
makes the carry exact: resetting the stamp to `now` each tick would discard
the remainder every time and reproduce the `floor` bug.

One stamp shared by both resources cannot work once MP is ungated and HP is
not: the two rates pay for different spans of time, so either the faster
resource is permanently short-changed, or clearing HP's accrual during a
fight also throws away the MP the character was owed for the same seconds.
Deriving HP's window start with `max` rather than clearing a stamp on every
blocked tick is what keeps that asymmetry to one expression instead of a
rule each writer has to remember: the gate is a lower bound on the window,
not an event that has to mutate state.

**Verification Description**
A unit test over the pure arithmetic: at 0.5 HP/s with a 1 s tick, ten
successive ticks grant 0,1,0,1,… for a total of 5 — not 10 and not 0 — and
the returned paid-up-to stamp advances by 2 s on each paying tick.
Further cases pin a rate of 0 (no grant, no advance), a rate above one per
tick (grants the whole part, carries the rest), and the window
derivation — an HP window whose `lastCombatAt + delay` lies in the future
yields zero, and one that lies in the past yields only the time since it,
never the time spent fighting.
An integration test asserts the same end to end: a character damaged
repeatedly for well over the delay recovers HP at the normal rate
afterwards rather than jumping to full on the first tick, while its MP
climbs throughout.

## Relations

**Realizes**

- [SYS-016](SYS-016-characters-recover-hp-and-mp-out-of-combat.md)

**Related**

- [SW-059](SW-059-one-regen-tick-restores-every-alive-characters-hp-and-mp.md) — the tick that applies this arithmetic
- [SW-057](SW-057-out-of-combat-gates-hp-regen-only.md) — the gate that forms HP's window start
- [CON-037](CON-037-regen-only-adds-inside-a-living-characters-headroom.md) — the clamp applied after this amount is computed

## Changes

- **2026-11-21** — Set active: implementation of STR-016 began.
  The spec is authored, reviewed and approved, so it now generates a
  traceable for the code written in this increment to anchor against.
- **2026-11-21** — Moved the no-banking rule off the regen tick and onto the
  paths that lower a resource or re-base its maximum, and said explicitly
  that an unpayable tick writes no row.
  Implementing the carry exposed the hole and then the cost of the obvious
  patch: a stale window on a full resource is a redeemable backlog (ten
  minutes at full would heal the first point of damage straight back, and a
  character with no `hpRegen` would bank a windfall to cash on equipping
  one), but having the tick reset every full resource's stamp would write one
  row per character per second on an idle server — the exact subscription
  storm `SW-059` rejects.
  Restamping where a resource is already being written costs nothing and
  closes both.
- **2026-11-21** — Pinned that a tick cut short by the headroom discards its
  surplus window instead of carrying it.
  A review of the implementation caught that this is the ordinary outcome for
  anyone who idles or logs off long enough to reach full, not an edge case:
  the stamp advanced only by the few seconds it could pay, so a character
  back from an hour away held an hour of redeemable regen.
  Damage resolution restamps HP before anything can spend that window, so this
  is not a live HP bug — it moves the no-banking guarantee into the tick
  instead of resting it on every present and future lowering path, of which MP
  currently has none.
  It is distinct from the unpayable-tick rule above because this branch does
  grant something, so the row is written either way and discarding costs
  nothing.
