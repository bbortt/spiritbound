**Title**
Card and item drops are independent per-death rolls against separate named chances

**Lens**: SW

**Status**: active

**Description**
On every enemy death, a card drop roll (against `CARD_DROP_CHANCE = 0.25`)
and an item drop roll (against `ITEM_DROP_CHANCE = 0.20`) both happen,
independently of each other — a single kill can drop a card, an item,
both, or neither.
Each roll is a strict `randomRoll < CHANCE` check against
a single `ctx.random()` draw.

**Rationale**
Independence keeps the two economies (cards vs. gear) tunable separately
without one roll starving the other.
The specific percentages are a first
rebalance pass down from 70%/40%, explicitly flagged in `docs/BALANCE.md`
as pending real playtest data, not final.

**Verification Description**
A unit test with a fixed `randomRoll` just under vs. just over each
threshold asserts the roll gate behaves as a strict `<` comparison against
the named constant, independently for the card roll and the item roll.

## Relations

**Realizes**

- [SYS-004](SYS-004-enemy-deaths-roll-level-gated-rarity-weighted-ground-drops.md)
