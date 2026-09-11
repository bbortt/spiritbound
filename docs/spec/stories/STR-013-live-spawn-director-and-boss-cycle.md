**Title**
A scheduled per-zone director executes population allocation live, and zone bosses run an independent spawn cycle

**Status**: planned

**Business Value**
The pure allocation math from the previous story in this increment is
inert until something actually calls it on a schedule and acts on its
output.
This story is what a player experiences: enemies quietly
thinning out of an area they've leveled past and reappearing where the
group actually is, and — separately — a zone boss that shows up on a
predictable cycle instead of camping the map forever or never existing.

**Problem / Context**
There is no scheduled process anywhere that reads player positions and
enemy counts and adjusts population.
The only respawn mechanism today is
a flat, always-respawn 15s timer (`ARCH-004`'s `enemyRespawnSchedule`),
which cannot retire an enemy whose area no longer needs it.
There is also
no concept of a boss enemy at all — every enemy is equally permanent and
equally killable at any time.

**Solution Approach**
Two scheduled reducers. `spawnDirectorTick` runs once per zone, on its
own scheduled row set to that zone's `content/zones.json`
`director.tickSeconds` interval (rather than one global tick gating
itself against every zone's cadence) — mirroring the existing
per-instance scheduling idiom used for `enemyRespawnSchedule`, but
interval-based.
Each tick: count alive characters per band, call
`computeTargetPopulation`/`allocateBands`/`planAdjustments` from the
previous story, and execute the result under two gates — a spawn must
find a valid point far enough from every player or is skipped; a despawn
only fires after a band has read over-target for
`sustainedDeviationTicks` consecutive ticks (tracked on a new
`zoneDirectorState` table), and only ever targets an enemy that is
simultaneously idle, undamaged, boss-free, and far from every player.

The existing flat 15s respawn (`respawnEnemy`) is changed to call the
passive-respawn decision function from the previous story instead of
unconditionally reviving: retire the row if its band is at/over target,
otherwise respawn with a level re-rolled into whichever band most needs
it.
This is the primary channel through which population actually
rebalances, and it is invisible to players since it only ever acts on
enemies that were already dead.

`bossCycleTick` runs as a single global 30s interval (the brief specifies
a fixed global cadence here, unlike the per-zone director tick) and, per
zone with a `boss` config: spawns the boss at `boss.arenaX/arenaY` when
absent and enough time has passed since it last stopped being alive;
force-despawns it when its window elapses, killed or not; and restarts
the cycle clock the moment it stops being alive either way.
The boss is
never counted in the director's population/target/actual accounting.
Client: a fade-in/hold/fade-out announcement banner on spawn (following
the existing level-up banner pattern in `GameScene.ts`), a rarity-coloured
outline and larger radius on the boss's rendered circle, and an HUD
corner timer showing remaining time (alive) or return time (down),
formatted by a small pure function extracted and unit-tested per the
testing contract.

**Acceptance Criteria**

- A solo player at level 1 sees mobs cluster in band 0 with a few
  elsewhere, total near `population.min`; levelling to 9 shifts
  population toward band 4 over a few ticks with no despawn visibly near
  the player.
- No enemy within `despawnSafeDistPx` of any alive player is ever
  deleted by the director.
- A band reading over-target for fewer than `sustainedDeviationTicks`
  ticks produces no despawn; reaching the threshold does.
- A spawn attempt that finds no point `>= minSpawnDistFromPlayerPx` from
  every player is skipped that tick, never forced closer.
- The boss spawns at its configured arena point on schedule, banners and
  HUD-timer text appear/update correctly, and it force-despawns at
  `windowMinutes` even if never damaged.
- Killing the boss and letting the window expire unkilled both restart
  the cycle clock from that moment.
- The director's band counts, in a zone with an active boss, never
  include the boss enemy.

**Out of scope**

- Any change to the drop table or XP a boss kill yields beyond what the
  enemy-rarity story already scales by rarity — this story only handles
  the boss's presence/absence lifecycle.
- Zone 2 or any second zone running a director — only `hollow-vale`
  exists as seeded content.

## Relations

**Realizes**

- [SYS-014](../specs/SYS-014-a-scheduled-per-zone-tick-executes-population-allocation-and-gates-despawns-on-sustained-deviation.md)
- [SYS-015](../specs/SYS-015-zone-bosses-run-an-independent-spawn-despawn-cycle-excluded-from-population-accounting.md)
- [ARCH-013](../specs/ARCH-013-each-zones-director-runs-on-its-own-scheduled-interval-sized-to-its-configured-tick-seconds.md)
- [CON-027](../specs/CON-027-despawns-require-sustained-over-target-deviation-spawns-need-no-such-gate.md)
- [CON-028](../specs/CON-028-a-despawn-target-must-be-idle-undamaged-boss-free-and-far-from-every-player.md)
- [CON-029](../specs/CON-029-a-spawn-point-must-clear-the-minimum-player-distance-or-the-spawn-is-skipped.md)
- [CON-030](../specs/CON-030-boss-enemies-never-count-toward-band-population-target-or-actual-accounting.md)
- [CON-031](../specs/CON-031-a-boss-window-closes-on-its-timer-unconditionally-even-if-undamaged.md)
- [CON-032](../specs/CON-032-the-boss-cycle-timer-restarts-the-moment-the-boss-stops-being-alive.md)
- [SW-049](../specs/SW-049-the-boss-hud-timer-formats-remaining-or-return-time-by-alive-state.md)

**Related**

- [ARCH-004](../specs/ARCH-004-enemy-tick-is-one-scheduled-reducer-driving-a-five-state-machine.md) — the existing scheduled-reducer precedent this story's ticks follow the shape of
- [SYS-013](../specs/SYS-013-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md) — the pure decision logic this story executes
- [SW-048](../specs/SW-048-passive-respawn-retires-an-over-target-enemy-or-re-rolls-it-into-the-neediest-band.md) — the function the changed respawn reducer now calls
- [ARCH-012](../specs/ARCH-012-enemy-rarity-and-boss-flag-are-columns-on-the-flat-enemy-row.md) — the `isBoss` column this story's despawn/accounting gates read
- [SW-014](../specs/SW-014-resetting-enemy-walks-to-spawn-healing-and-can-re-aggro.md) — **partially superseded**: its respawn-half claim ("regardless of whether any character is nearby") is replaced by `SW-048`'s passive-rebalance decision; its resetting-state-machine half is unaffected
