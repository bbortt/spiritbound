**Title**
The boss HUD timer formats remaining-or-return time by the boss's alive state

**Lens**: SW

**Status**: planned

**Description**
A pure, Phaser-free client function takes the boss's alive state and the
relevant timestamp (either `bossSpawnedAt` while alive, or the last time
it stopped being alive while down) plus the current time, and returns the
HUD string: `"Warden: 3:42 remaining"` while alive (counting down to
`windowMinutes` after spawn), or `"Warden returns in 6:18"` while down
(counting down to `cycleMinutes` after it stopped being alive).
The boss
name is content-authored (`zone.boss.slug`/a display name), not
hardcoded.

**Rationale**
`005-testing-contract.md` requires extracting and unit-testing pure
sub-logic even inside otherwise-manual-QA client rendering; the phrasing
switch and the two different countdown targets are exactly the kind of
logic that's easy to get backwards (counting up instead of down, or
reading the wrong timestamp for the current state) and cheap to pin with
a test, unlike the glow colour or banner fade, which stay visual-only.

**Verification Description**
A unit test asserts the alive-state string and countdown target
(`windowMinutes` from `bossSpawnedAt`) and the down-state string and
countdown target (`cycleMinutes` from the last-alive timestamp), including
the minute:second formatting at a boundary (e.g. exactly 60 seconds
remaining reads `1:00`, not `0:60`).

## Relations

**Realizes**

- [SYS-015](SYS-015-zone-bosses-run-an-independent-spawn-despawn-cycle-excluded-from-population-accounting.md)
