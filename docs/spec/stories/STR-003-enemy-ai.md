**Title**
Enemy AI — server-authoritative aggro, chase, telegraph, and respawn

**Status**: active

**Business Value**
Per the "preparation over reaction" pillar, enemies must be visibly readable
(a fixed aggro range, a telegraphed cast) and never able to out-run the
player, so a death always traces back to a player's own choice — never an
unavoidable ambush the player had no way to see coming or escape.

**Problem / Context**
This is a retrofit story: the enemy AI state machine (aggro/chase/telegraph/
reset/respawn) already shipped in a prior session and is live in the
codebase.
No spec currently records its exact behavior, and the state
machine itself is not test-anchorable as it stands: the entire five-state
transition logic currently lives inline in `spacetimedb/src/index.ts`'s
`enemyTick` reducer body, reading and writing `ctx.db.enemy` directly,
rather than being extracted to a pure function in `spacetimedb/src/rules/*.ts`
as this repo's own architecture rule requires (thin reducers, pure rules
functions — see `docs/spec/architecture.md`).
Two of its helpers,
`_distSq` and `_moveToward`, are already pure (no `ctx` dependency) and
need no refactor at all.

**Solution Approach**
Author SW specs for each state-transition behavior (aggro acquisition,
chasing's three-way branch, the telegraph-then-damage cast, cooldown's
recast/re-engage branch, and resetting/respawn), one CON for the
chase-speed-vs-player-speed guarantee, and one ARCH spec restating the
existing "single scheduled tick, five-state machine" decision.
As part of
this story's anchoring pass (not this drafting pass), extract the
transition logic into a new, pure `computeEnemyTickTransition(enemy,
target, now, tuning)` function in a new `spacetimedb/src/rules/enemyAi.ts`,
so `enemyTick` becomes a thin shell like every other reducer; `_distSq`/
`_moveToward` move there too (unchanged) since they are already pure.
Add `spacetimedb/src/rules/enemyAi.test.ts` (does not exist yet) covering
every SW spec below.

**Acceptance Criteria**

- Every spec below is anchored to the (post-extraction) code that realizes
  it.
- `_distSq`/`_moveToward` and the extracted transition function each have
  a vitest unit test the corresponding SW spec's `verifies` anchor points
  to.
- `clew coverage` shows every spec in this story as Covered.
- No existing aggro/chase/telegraph/respawn behavior changed — this is a
  documentation-and-test retrofit (plus the thin-reducer extraction it
  depends on), not a feature or balance change.

**Out of scope**

- Combat damage math itself, once a hit or cast connects — covered by the
  Combat Resolution story.
- Drop rolls on enemy death — covered by the Drop System story.
- XP granted to the killer on enemy death — covered by the XP & Leveling
  story.
- This story is only the aggro/chase/telegraph/respawn state machine.

## Relations

**Realizes**

- [SYS-003](../specs/SYS-003-enemies-aggro-chase-and-attack-under-server-authority.md)
- [SW-010](../specs/SW-010-idle-enemy-aggroes-onto-closest-character-in-range.md)
- [SW-011](../specs/SW-011-chasing-enemy-attacks-resets-or-closes-distance.md)
- [SW-012](../specs/SW-012-telegraphed-cast-fires-once-after-its-duration-hitting-everyone-in-range.md)
- [SW-013](../specs/SW-013-cooldown-recasts-on-timer-or-re-engages-if-target-moved-out-of-range.md)
- [SW-014](../specs/SW-014-resetting-enemy-walks-to-spawn-healing-and-can-re-aggro.md)
- [CON-003](../specs/CON-003-chase-speed-is-always-slower-than-player-move-speed.md)
- [ARCH-004](../specs/ARCH-004-enemy-tick-is-one-scheduled-reducer-driving-a-five-state-machine.md)
