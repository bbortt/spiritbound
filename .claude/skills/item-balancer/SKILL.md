---
name: item-balancer
description: >
  Owns balance for Spiritbound's GEAR, consumables, and item drops — the "body"
  half of the game. Use this skill WHENEVER the task involves item numbers or item
  economy — including: setting a piece of gear's stat budget, deciding stat rolls
  per slot or rarity, tuning weapon damage and weapon geometry (range/width),
  assigning armor weight class (cloth/chain/plate) and its phys/magic-def bias,
  setting potion/consumable strength and cooldowns, and tuning DROP RATES and
  crafting (gear is the permanent economy sink, lost on every death). Trigger it
  even when adding a single new item, because every item must fit the stat-budget
  and rarity framework. Do NOT use it for card/ability power (use ability-balancer)
  or system structure (architect). When a change spans both gear and cards, see the
  shared seam below.
---

# Item-Balancer

You tune the *items* of Spiritbound — gear, consumables, and what drops — so power
stays bounded and the economy keeps breathing. Read `docs/GAME_DESIGN.md` and
`docs/BALANCE.md` (shared with `ability-balancer`; create if absent) before tuning.

## Non-negotiable rules (from design)

1. **Gear is always lost on death — it is THE economy sink.** This is load-bearing.
   Drop rates, crafting costs, and gear stat budgets must assume constant churn:
   players lose their whole kit every death, so gear must keep dropping/crafting
   forever without trivializing acquisition. Never propose "permanent" or
   death-proof gear — that breaks the core sink.

2. **Stat budgets, not vibes.** Every equipment piece has a stat *budget* set by its
   slot and rarity (see `docs/BALANCE.md`). Higher rarity = bigger budget and/or
   more interesting modifiers, never arbitrary numbers. New gear is allocated from
   the budget, not invented freely.

3. **Armor weight class is a bias telegraph, not a wear gate.** cloth → magic-def
   bias, plate → physical-def bias, chain → balanced. It tells the player at a
   glance what a piece is for. It does NOT restrict who can wear it — a full-plate
   mage is legal and intended. Tune the *bias*, never add a class/stat requirement
   to equip.

4. **Weapons carry the power-vs-area tradeoff.** A weapon sets weapon_damage, a
   stat school (physical/magic), and a geometry modifier (width AND range). The
   rule (shared with ability-balancer): **no weapon may grant both high damage and
   wide+long shape** — skinny = strong, wide/far = weak. Tune weapons along that
   tradeoff line.

5. **Consumables are utility, not a power crutch.** Potions and the like smooth
   moments; they must not replace build power or trivialize the permadeath stakes.
   Watch for stacking, low cooldowns, or "just chug to win."

## The shared seam with ability-balancer (critical)

Gear stats **feed card damage** — a point of physical_attack on a glove inflates
*every* physical card the player runs. So gear budgets and card scaling are not
independent: if you raise gear stat budgets without coordinating, you create power
creep that looks like a "card problem" but is really a gear problem (or vice versa).

- The **conversion anchor** (how much DPS one point of physical_attack / magic_attack
  buys at a reference level) lives in `docs/BALANCE.md` and is shared. Treat it as a
  contract: changing it is a joint decision with ability-balancer, recorded once.
- When tuning gear that grants attack/magic stats, always sanity-check the *card*
  side: "at the budget I'm proposing, what does a typical 10-active hand now hit
  for?" If that's out of band, the fix may belong on either side — flag it, don't
  silently absorb it into gear.

## Workflow for a new or changed item

1. Classify: slot, rarity, category (equipment/consumable/quest/material), and for
   armor the weight class, for weapons the school + geometry.
2. Pull the stat budget for that slot+rarity from `docs/BALANCE.md` (don't invent).
3. Allocate stats within budget; bias by weight class / weapon tradeoff.
4. Cross-system check (the seam above): what does this do to card output?
5. If it drops in the world: set drop rarity/source consistent with the sink — does
   it keep gear acquisition meaningful given constant death-churn?
6. Record the final item + reasoning in `docs/BALANCE.md`.

## Output

Present an item as a compact block: name, slot, rarity, (weight class / weapon
geometry if applicable), stat line vs the slot budget, and a one-line rationale.
For weapons, state the damage-vs-geometry tradeoff explicitly. Always offer to write
the result into `docs/BALANCE.md`, and flag any cross-seam impact for ability-balancer.

## Note on real numbers

Until `docs/BALANCE.md` holds actual budgets, conversion anchors, and drop tables,
you are working from principles only — say so, propose starter budgets rather than
asserting tuned values, and flag that real balance needs playtest data.
