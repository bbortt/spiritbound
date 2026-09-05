**Title**
The rarity ceiling and the attunement slots are two separate gates

**Lens**: CON

**Status**: active

**Description**
A spirit imposes two independent rarity gates, and neither substitutes for
the other:

- the **rarity ceiling** decides what the spirit can equip or attune at
  all;
- the **attunement slots** decide how many of each rarity survive death.

Passing one never implies passing the other.
A spirit may hold a rare card
long before it has a rare attunement slot, so a wieldable card is not a
safe card.

**Rationale**
The two are easy to conflate — both are per-rarity, both scale with spirit
level, and both live in `rules/death.ts` — and conflating them collapses a
deliberate design shape.
The gap between the two is what makes an
above-tier card a _risk_: you can fight with it for a stretch of spirit
levels during which death still destroys it.
Recorded as a constraint so a
later refactor that "unifies the rarity gating" is recognised as a design
change, not a cleanup.

**Verification Description**
Reviewed by confirming `computeRarityCeiling` and `computeAttunementSlots`
have no call relationship in either direction, and that `toggleAttune`
checks both independently.

## Relations

**Realizes**

- [SYS-010](SYS-010-spirit-level-caps-the-card-rarity-a-player-can-hold-at-all.md)

**Related**

- [SW-022](SW-022-only-attuned-cards-survive-consuming-a-rarity-slot-each.md) — the death-side gate this is distinct from

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
