**Title**
A boss window closes on its timer unconditionally, even if undamaged

**Lens**: CON

**Status**: planned

**Description**
Once `windowMinutes` has elapsed since a boss spawned, it is deleted —
regardless of its current HP, whether it has ever been engaged, or
whether it is mid-combat.
This is unconditional, unlike the ambient
director's despawn, which never removes an enemy that fails any of
`CON-TMP-010`'s conditions.

**Rationale**
The boss is explicitly "a window, not a persistent mob" — its value is
the limited-time opportunity, not permanence.
Making its despawn
unconditional (rather than gated on idle/undamaged/no-nearby-player like
an ordinary enemy) is the deliberate contrast that keeps the encounter a
genuine ticking clock rather than something a group could stall
indefinitely by keeping it engaged.

**Verification Description**
An integration test spawns a boss, damages it without killing it, advances
past `windowMinutes`, and asserts it is deleted regardless of its current
HP or engagement state.

## Relations

**Realizes**

- [SYS-TMP-004](SYS-TMP-004-zone-bosses-run-an-independent-spawn-despawn-cycle-excluded-from-population-accounting.md)

**Related**

- [CON-TMP-010](CON-TMP-010-a-despawn-target-must-be-idle-undamaged-boss-free-and-far-from-every-player.md) — the ordinary despawn gate this unconditional rule deliberately contrasts with
