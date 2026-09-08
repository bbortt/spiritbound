**Title**
The boss cycle timer restarts the moment the boss stops being alive

**Lens**: CON

**Status**: planned

**Description**
Whether the boss is killed by players or force-despawned when its window
elapses, the zone's `cycleMinutes` clock (tracked as a "last stopped being
alive" timestamp on `zoneDirectorState`) restarts from that moment.
There
is no separate accounting for a kill versus a timeout — both set the same
clock the same way.

**Rationale**
Both endings mean the same thing operationally: the boss is no longer
present, and the zone should wait a full cycle before it can appear
again.
Treating them identically is simpler than the alternative (a
shorter cooldown for a kill, say) and matches the brief, which never
distinguishes the two paths.

**Verification Description**
An integration test kills the boss and asserts the next spawn eligibility
is `cycleMinutes` after the kill; a separate test lets the window expire
unkilled and asserts the next spawn eligibility is `cycleMinutes` after
the forced despawn — both measured from the same kind of timestamp.

## Relations

**Realizes**

- [SYS-TMP-004](SYS-TMP-004-zone-bosses-run-an-independent-spawn-despawn-cycle-excluded-from-population-accounting.md)
