**Title**
A character equips gear across a fixed set of body slots to change its combat stats

**Lens**: SYS

**Status**: active

**Description**
A character can hold zero or one item in each of a fixed set of equip
slots (main hand, off hand, head, neck, chest, hands, legs, boots, two
rings, two earrings).
Equipping or unequipping an item immediately and
visibly changes the character's combat stats — every equipped item's stat
modifiers stack additively on top of a race base.
This is the "gear is
your body" half of the game's stat model, distinct from cards (see the
Hand/Card Management story).

**Rationale**
Per `docs/GAME_DESIGN.md` and the pillar "gear is your body," gear must be
felt immediately (stat changes on equip) and lost permanently on death
(the economy sink) — both require gear to be a live, server-tracked,
per-character state rather than a cosmetic or client-only concept.

**Verification Description**
Reviewed via the SW specs this realizes, each independently verifiable by
test or manual QA.

## Relations

**Related**

- [STR-001](../stories/STR-001-equipment-system.md) — the story delivering this capability
