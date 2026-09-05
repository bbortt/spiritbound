**Title**
Effective stats are the race base plus every equipped item's modifiers, summed additively, never persisted

**Lens**: SW

**Status**: active

**Description**
A character's effective `StatBlock` is computed fresh on every read as
`computeRaceBase(raceId)` (currently one hard-coded placeholder,
`raceId` ignored) plus each currently-equipped item's `statModifiers`,
field-by-field addition, with no multiplicative or percentage scaling.
The result is never written to any table row — every consumer
(`resolveHit`, HP/MP max, the client HUD and character sheet) recomputes
it from current equip state at the moment it is needed.

**Rationale**
Per the architecture's derived-values rule (`docs/spec/architecture.md`),
a value computable from other stored state must not itself be stored —
storing it would create a second place that could go stale relative to
the character's actual equipped items.
Purely additive stacking (no
per-item diminishing returns) is a deliberate first-pass simplicity choice
pending a real stat-budget model (see `docs/BALANCE.md`).

**Verification Description**
A unit test calls `computeEffectiveStats(raceBase, [itemA, itemB])` and
asserts every field equals `raceBase[field] + itemA.statModifiers[field]

- itemB.statModifiers[field]`, including a field only one item modifies
  and a field neither modifies (stays at race base).

## Relations

**Realizes**

- [SYS-001](SYS-001-equip-gear-to-change-combat-stats.md)

**Related**

- [ARCH-002](ARCH-002-client-effective-stats-is-a-hand-synced-duplicate.md) — the client's hand-synced duplicate of this formula
