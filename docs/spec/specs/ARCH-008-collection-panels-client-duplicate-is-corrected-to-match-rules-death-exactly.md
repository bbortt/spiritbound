**Title**
CollectionPanel's client-side hand-slot/attunement duplicate is corrected to match rules/death.ts exactly

**Lens**: ARCH

**Status**: active

**Description**
`CollectionPanel.ts` previously carried its own inline `computeHandSlots`/
`computeAttunementSlots` — different formulas than the server, and, for
attunement, a single combined number instead of the server's real
per-rarity breakdown.
This retrofit corrects it by extracting a shared
`client/src/handSlots.ts` that mirrors
`spacetimedb/src/rules/death.ts#computeHandSlots`/`computeAttunementSlots`
exactly (per-rarity, field-for-field), replacing the local copy —
following the same hand-synced-duplicate pattern already accepted for
`client/src/effectiveStats.ts`
([ARCH-002](ARCH-002-client-effective-stats-is-a-hand-synced-duplicate.md))
and `client/src/levelCurve.ts`, now a fourth instance of the class — but
this one specifically because the prior copy had silently drifted rather
than because a new duplicate was freshly authored correctly.

**Rationale**
Recorded as a genuine defect-and-fix, not just an accepted tradeoff like
its siblings, because the numbers were simply wrong, not merely at risk of
going stale — the UI was showing a player an incorrect slot count.

**Verification Description**
`client/src/handSlots.test.ts` (new) asserts the extracted functions
produce output identical to `spacetimedb/src/rules/death.ts`'s real
formulas across a swept range of spirit levels, for both hand slots and
per-rarity attunement slots.

## Relations

**Related**

- [SW-027](SW-027-hand-slot-caps-grow-with-spirit-level-independently-for-active-and-passive.md)
- [STR-001](../stories/STR-001-equipment-system.md) — the effectiveStats duplication precedent
