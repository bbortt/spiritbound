**Title**
Spirit level is a log-shaped curve over bond XP, grown by sacrificing cards

**Lens**: SW

**Status**: active

**Description**
`computeSpiritLevel(bondXp) = clamp(1, 50, floor(log10(bondXp+1) * 17))` —
a placeholder log-shaped curve (roughly: 100 XP ≈ level 1, 10,000 ≈ level
10, 1,000,000 ≈ level 50), pending playtest validation per
`docs/BALANCE.md`.
Sacrificing a card (`sacrificeCard`) grants bond XP by
the burned card's rarity (`SACRIFICE_XP`: common 10, uncommon 50, rare
200, epic 800, legendary 3000), deletes the card, and recomputes the
spirit's level — all in the same reducer call.

**Rationale**
Log-shaped growth is deliberately front-loaded so early spirit levels
(and the hand-slot/attunement growth they unlock) come fast, with
diminishing returns at high bond XP; a legendary sacrifice being worth
300× a common's XP is meant to make burning one a real, felt decision.

**Verification Description**
A unit test asserts the curve's clamp bounds and rough log shape at the
three anchor points BALANCE.md names (~100/~10,000/~1,000,000 XP ≈ levels
1/10/50); a test calling the sacrifice logic asserts the exact
`SACRIFICE_XP` value is added per rarity and the card no longer exists
afterward.

## Relations

**Realizes**

- [SYS-006](SYS-006-death-destroys-gear-and-un-attuned-cards-keeps-only-what-was-attuned.md)
