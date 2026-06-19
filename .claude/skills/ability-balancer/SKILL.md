---
name: ability-balancer
description: >
  Owns gameplay balance for Spiritbound's cards, abilities, and progression math.
  Use this skill WHENEVER the task involves in-game numbers or power tuning —
  including: designing or adjusting a card's damage/healing/cooldown, setting
  rarity, deciding how a card scales with character level vs merge level, hand-slot
  counts and unlock pacing, spirit-level card-retention odds or attunement-slot
  counts, and any "is this too strong / too weak / will this cause power creep?"
  question. Trigger it even when the user is inventing a single new card, because
  every new card must fit the scaling and rarity framework. Do NOT use it for
  story/flavor (lore-keeper), system structure (architect), or gear/consumable/drop
  balance (item-balancer) — though gear and cards share a power seam, see below.
---

# Ability-Balancer

You tune the *numbers* of Spiritbound so the game stays fair, readable, and free
of power creep. Read `docs/GAME_DESIGN.md` and `docs/BALANCE.md` (shared with
`item-balancer`; create if absent) before tuning. This skill encodes the balance
*philosophy*; `docs/BALANCE.md` holds the concrete target tables.

## Shared seam with item-balancer (critical)

Card damage **reads gear stats** — a card's output depends on the physical_attack /
magic_attack the player's gear provides. So card scaling and gear budgets are not
independent. The **conversion anchor** (DPS per point of attack stat at a reference
level) lives in `docs/BALANCE.md` and is shared; changing it is a joint decision
with `item-balancer`, recorded once. When a card feels too strong/weak, check
whether the real lever is the card or the gear feeding it before nerfing the card.

## Non-negotiable balance rules (from design)

These come from core design decisions — protect them:

1. **Two scaling axes, kept separate.**
   - **Character level** scales a card's *raw numbers* (damage, healing). This
     exists so old/common cards never become dead loot as the player levels.
   - **Merge level** scales a card's *effects* — extra projectile, longer
     duration, an added passive rider — **not** raw numbers.
   - Never let a single card gain big raw-number boosts from *both* axes. That is
     the power-creep double-dip the design explicitly forbids. If a proposed card
     does this, flag it and rebalance.

2. **Horizontal > vertical for rarity.** Higher rarity should mean *more
   interesting/situational*, not strictly *bigger numbers*. A legendary should
   change how you play, not just out-stat a common. Resist "legendary = common ×3."

3. **PvE-first balance.** Tune against PvE encounters, not player-vs-player. If
   PvP is ever gated in, balance it separately; never let PvP concerns nerf the
   PvE feel.

4. **Hand limits are the master lever.** Target ~10 active + 5 passive slots, but
   slots are themselves progression (start smaller, ~4/2, unlock via character
   level / spirit bonds). When something feels overpowered, ask whether the fix is
   the card's numbers or the *opportunity cost* of a slot — often the slot is the
   better lever.

## Death & spirit math

- Personal spirit grants card-survival on death. Current leaning: **attunement
  slots** (spirit level → N guaranteed-survival slots) over pure RNG, because a
  guaranteed-loadout choice is a better player decision than a rage-inducing roll.
  Optionally a small RNG bonus for un-attuned cards.
- When tuning spirit progression, the value being granted is **access and safety**
  (attunement slots, swap-rarity ceiling, swap-while-traveling), *not* combat
  power. Keep spirit power out of the damage equation.
- Card sacrifice (feeding cards to level a spirit) must stay a real cost — the
  attunement/access gained should feel worth burning a card, but never so cheap
  that sacrificing is free.

## Workflow for a new or changed card

1. Identify role (active/passive), rarity, and which axis carries its growth.
2. Assign raw numbers via the **character-level scaling curve** in
   `docs/BALANCE.md` (don't invent ad-hoc numbers — anchor to the curve).
3. Define merge-level effects as *horizontal* additions only.
4. Sanity checks:
   - Does it double-dip raw scaling? (reject)
   - Is its power mostly numbers or mostly an interesting effect? (prefer effect)
   - What's its slot opportunity cost — would a player drop something good for it?
   - Does it trivialize a PvE encounter type? (note it)
5. Record the final stat line and reasoning in `docs/BALANCE.md`.

## Output

Present a card as a compact stat block: name, rarity, slot type, base numbers @
reference level, the level-scaling rule, and the per-merge-level effect. Then a
one-line balance rationale. If you changed an existing card, show before/after and
why. Always offer to write the result into `docs/BALANCE.md`.

## Note on real numbers

Until `docs/BALANCE.md` has actual target curves, you are working from principles
only — say so, and propose starter curves rather than asserting tuned values. Real
balance needs playtest data; flag when a number is a guess awaiting testing.
