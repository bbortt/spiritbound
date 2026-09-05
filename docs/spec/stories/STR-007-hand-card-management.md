**Title**
Hand/Card Management — a spirit-level-gated card loadout, changed only through equip/unequip/sacrifice

**Status**: active

**Business Value**
The Hand (equipped active/passive cards) is the moment-to-moment
expression of "cards are your soul" — capped growth tied to spirit level
(not character level) ties build-crafting progression to the permanent,
death-surviving spirit track, distinct from character level's combat-stat
progression.

**Problem / Context**
Retrofit story: this logic already shipped.
While researching it, a real
bug was found: the client's local hand-slot/attunement-slot duplicate
(`client/src/ui/CollectionPanel.ts`) has drifted from the server's real
formulas (different constants, and attunement collapsed to a single
number instead of the server's real per-rarity breakdown) — already
flagged as a known duplication-risk pattern in `docs/ARCHITECTURE.md`, but
never actually fixed.
Separately, the design rule "you can only change
your Hand at a spirit" turns out to be enforced client-side only —
`equipCard`/`unequipCard` accept the call from anywhere server-side.

**Solution Approach**
Author SW specs for `computeHandSlots`, `equipCard`'s slot-cap-and-replace
behavior, and `sacrificeCard`'s collection-removal effect.
Author two ARCH
specs: one documenting the client-only "at a spirit" enforcement gap
(mirroring the honesty of the existing "login server deferred" ADR), one
documenting the `CollectionPanel` drift and that this retrofit's
anchoring pass corrects it — extracting a shared, correct
`client/src/handSlots.ts` mirroring `rules/death.ts` exactly (per-rarity
attunement included), replacing the local duplicate.
This is a real code
fix made during anchoring, not just documentation.

**Acceptance Criteria**

- Every spec anchored to the implementing code.
- `computeHandSlots` gets a unit test in `spacetimedb/src/rules/death.test.ts`
  (shared with the XP & Leveling and Death & Retention stories' additions
  to that same file).
- The corrected `client/src/handSlots.ts` gets its own unit test asserting
  it matches the server's `rules/death.ts` formulas exactly, for both hand
  slots and per-rarity attunement slots.
- `CollectionPanel.ts` no longer carries its own inline, drifted copy of
  either function.

**Out of scope**

- What happens to cards AT death, or the attunement slot mechanics
  themselves — owned by the Death & Retention story
  ([STR-006](STR-006-death-and-retention.md)); this story only
  covers the Hand's own active/passive slot caps and the equip/sacrifice
  reducers.
- Adding a server-side "must be near a spirit" check to close the
  trust-boundary gap this story documents — recording the gap is in
  scope, closing it is a separate future change.

## Relations

**Realizes**

- [SYS-007](../specs/SYS-007-the-hand-is-a-spirit-level-gated-card-loadout.md)
- [SW-027](../specs/SW-027-hand-slot-caps-grow-with-spirit-level-independently-for-active-and-passive.md)
- [SW-028](../specs/SW-028-equip-card-enforces-level-gate-and-hand-slot-cap-replacing-only-the-exact-slot.md)
- [SW-029](../specs/SW-029-sacrificing-a-card-permanently-removes-it-from-the-collection.md)
- [ARCH-007](../specs/ARCH-007-hand-changes-only-at-a-spirit-is-enforced-client-side-only.md)
- [ARCH-008](../specs/ARCH-008-collection-panels-client-duplicate-is-corrected-to-match-rules-death-exactly.md)
