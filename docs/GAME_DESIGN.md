# Spiritbound (working title) — Game Design Document

A 2D/2.5D online RPG where **cards define your abilities, spirits guard your soul, and death is (almost) permanent**.

## Vision

A PvE-focused MMO RPG blending:

- **Aion** — fantasy world, progression depth (without the pay-to-win)
- **Skylords Reborn / BattleForge** — cards as the source of power
- **Hearthstone** — deck-building as the core build/meta loop
- **Souls-likes** — permadeath tension, preparation, meaningful loss
- **Realm of the Mad God** — existence proof: permadeath MMO, 2D, items define power, PvE co-op

**Core fantasy:** Your equipped cards ARE your build.
Your spirit is your soul's insurance policy.
Your body (gear) is always lost on death.

## Design Pillars

1. **Cards are your soul, gear is your body.** Cards can survive death (via spirits); physical equipment never does.
2. **Preparation over reaction.** You commit to a hand before venturing out (souls-like loop).
   Spirits are the "bonfires."
3. **PvE-first.** No open PvP nuking.
   If PvP ever exists, it is strictly level-and-zone gated.
4. **Every drop has value.** Duplicate cards are merge fuel or spirit sacrifices.
   Gear loss keeps the crafting economy alive forever.

## Character Systems

### Race (base stats)

Classic race system providing base stat distribution.
No classes — your equipped cards define your role.

### Gear (additive stats)

Equipment adds stats on top of race base, and carries the **stat types** that feed
your cards' scaling tags (a mage naturally accumulates magic-damage gear, which
quietly steers them away from swords — soft incentive, never a hard lock).
**All physical gear is lost on death, always.** This is the permanent economy sink.

**Equipment slots:** head, chest, hands, legs, boots, main-hand, off-hand,
necklace, 2× ring, 2× earring.

- **Main-hand** is the most mechanically important item — the weapon carries a
  stat type AND a **geometry modifier** (skinny vs wide area).
  See Combat & Mechanics.
- **Off-hand** (shield / focus) is a natural home for ward-style defensive stats.

**Armor weight classes** (cloth / chain / plate) telegraph an armor piece's
defensive bias — plate leans physical def, cloth leans magic def, chain in between.
This is a _readability_ aid (you can see a tank at a glance) and **not** a wear
restriction: anyone can wear anything, so a full-plate mage is a legal, intentionally
fun oddity.
Consistent with no-classes design.

**Set effects:** gear pieces can belong to a set; wearing N pieces grants tiered
bonuses (2-piece, 4-piece, …).
Because gear is lost on death, sets **re-form each
life**, which keeps players re-chasing pieces (good economy churn) — so sets must be
_repeatably_ attainable, never one-time grinds.
Set bonus stats feed card scaling
(item-balancer seam).

### Cards (abilities)

- Cards grant **active abilities** and **passive abilities**.
- **Anyone can learn, carry, and trade any card** — there are no class or weapon
  restrictions on which cards you can equip.
  Identity is _emergent_, not assigned
  (see Combat & Mechanics → emergent classes).
- Each card declares a **scaling tag**: which stat its power reads from (e.g.
  attack damage, magic damage).
  The same card performs differently depending on
  the weapon/gear feeding that stat — "the mighty swing" hits hard with a sword
  (high attack damage) and soft-but-wide with a staff.
- The equipped set is your **Hand**, capped at **10 active + 5 passive**.
  You
  **start at 2 active / 1 passive** (the tutorial hands you a pre-filled 1/1 so you
  learn the basics).
  - **Slots are granted by your personal spirit's level — not character level.**
    Leveling your character is the _means_ (easier farming → find & level spirits
    faster); the spirit is the _gate_.
- Some cards carry a **minimum character-level requirement** to equip.
  Permadeath
  wrinkle: your spirit may preserve a high-level card through death, but you must
  re-earn the level before you can wield it again.
- **Passives** come in two kinds: **wards** (protective — mitigation, shields,
  resistances) and **triggered** (fire on a condition, e.g. every 3rd hit).
- Unequipped cards live in inventory; the equipped Hand lives in the **deck**
  (separate from inventory, swapped at spirits — see Spirit System).
- Card numbers (damage, healing, etc.) scale with **character level** so old cards never become dead loot.
- **Card merging** (e.g. 3-to-1 ladder): merge level adds _effects_ (extra projectile, longer duration, passive riders) rather than raw numbers — horizontal power, avoids double-dip power creep with character level.
- **Combo chains:** a card can be a _chain link_ off another — casting the opener
  opens a brief window where the follow-up gains a bonus (Aion-style chain skills).
  One opener can branch into different follow-ups.
  This makes the 10-active hand a
  _sequencing_ skill, not ten independent buttons.
- **Evolution branches:** merging is a _tree_, not just a ladder — a card can evolve
  down different branches (e.g. fire vs frost) depending on catalyst/choice.
  Combined
  with combos, this gives skill-tree-like depth **without a point-buy tree**, so the
  loot-defines-build pillar stays intact (the "tree" emerges from collecting +
  merging, not spending points).

## Stats & Attributes

Adapted from Aion, reconciled with cursor-aimed combat.
Sources stack **additively**:
race seeds primary attributes, gear adds combat stats directly, passive (ward) cards
can add stats, level scales resources.
There are no class locks — your stat spread
is the soft, emergent class.

### Primary attributes (race-seeded; the only innate lean)

- **Power** → physical attack (scales physical-school cards + weapon damage)
- **Knowledge** → magic attack (scales magic-school cards)
- **Health** → max HP + HP regen
- **Will** → max MP + MP regen, magic resist, healing boost — the _caster-sustain_
  stat, so a healer/support itemizes differently from a nuker even though both are "magic"
- **Agility** → evasion, parry, attack speed
- **Precision** → accuracy, magic accuracy, crit chance

### Resources

- **HP** (current/max) + regen — at 0 you die (permadeath).
- **MP** (current/max) + regen — active cards cost MP; if you can't pay, the card
  won't fire (Aion rule).
  Optional: some cards cost HP (blood-magic flavor).
- **Move speed** (multiplier, 1.0 = base).

### Offensive (gear + primaries; what cards/weapons read)

- **Weapon damage** — weapon-only, base for basic attacks; school routed by the weapon.
- **Physical attack / Magic attack** — boost physical- / magic-school card damage
  (these are the card scaling tags).
  Healing reads magic attack × healing boost.
- **Physical crit / Magic crit** (+ optional crit-damage multiplier).
- **Accuracy / Magic accuracy** — counter the defender's evasion-parry / magic
  resist, and gate whether secondary status effects land.
- **Attack speed / Casting speed** — multipliers, higher = faster (we drop Aion's
  inverted "lower is better" convention for clarity).
- **Healing boost** — scales healing-card output.

### Defensive (gear + primaries)

- **Physical def / Magic def** — flat mitigation per school.
  Optional Aion-style
  weight classes: plate biases physical def, cloth biases magic def — a per-slot tradeoff.
- **Parry** — reduce a connected physical hit (capped), countered by accuracy.
- **Evasion** — avoid a connected hit (capped low), countered by accuracy.
- **Magic resist** — resist connected magic + reduce secondary-effect application,
  countered by magic accuracy.
- **Block** — off-hand shields.

### The cursor-aim reconciliation (key combat rule)

Because combat is cursor-aimed, **hitting is skill, mitigation is stats**:

1. **Connect** — your aim + weapon geometry vs the target's position decides if you
   geometrically land it.
   No "accuracy to land" RNG on your own shots.
2. **Resolve** — once connected, defense applies: def mitigates, then
   evasion/parry/resist may roll; the attacker's accuracy lowers the defender's
   effective avoidance.

**Decided (permadeath feel):** evasion is a **glancing blow** (partial damage
reduction), **not** a full negation, with **low caps**.
Full-negation dodges
produce feel-bad deaths in both directions under permadeath, so they're out.

## Combat & Mechanics

### Control scheme — cursor-aimed (Path of Exile style)

- **Click to move**; abilities fire **toward the cursor**.
  Aim matters — you can
  miss.
  This is a deliberate skill-based choice that reinforces the souls-like feel.
- **Fixed camera**, Diablo-style (top-down / isometric).
- Hotbar plan: left/right mouse for move + basic attack, the 10 active abilities on
  keys (1–0) cast toward the cursor.
  A radial or two-row hotbar is on the table —
  10 actives is a lot of inputs and needs a conscious UI plan.

### Weapons are attack geometry + stat carriers

Every weapon is an **area of effect** with a shape, plus a stat type:

- Dagger → short, skinny cone (precise, must be aimed tight, high single-target).
- Wider/longer weapons → broader arcs or lines.
- Staff → large area (forgiving aim), but channels magic damage.
- A weapon does two jobs: (1) it carries a **stat type** (attack vs magic damage,
  etc.) that feeds whatever card you cast, and (2) it applies a **geometry
  modifier** that bends an ability's **range and width** (e.g. a melee swing reaches
  _further and wider_ — but weaker — when swung with a staff).

### PvP

**None at launch — PvE only.** Roadmap (later, in order of difficulty): instanced
**arena** first, then someday **open-world PvP** (acknowledged hard: permadeath +
open PvP is a serious griefing and netcode problem, deliberately deferred).

### Emergent classes (no hard classes)

Identity is not assigned — it emerges from the intersection of:

- which **cards** you've learned/invested in (each has a scaling tag),
- which **weapon** you wield (stat type + geometry), and
- the **stat types** your accumulated gear provides.

Anyone can wield anything and learn any card; scaling simply rewards synergy.
This
keeps builds open, makes hybrid/off-meta builds genuinely discoverable, and gives
**every card trade value** — junk for one build is a keystone for another.

### The self-balancing tradeoff (balance rule)

Because the weapon trades **power for area** (skinny+strong vs wide+weak), it is a
built-in balance axis. **No single weapon may give both high damage and wide shape
on the same card** — that would break the tradeoff. (Enforced by the
`ability-balancer` skill.)

### Inventory vs deck

- **Inventory** holds _physical_ items: gear, potions, quest items, crafting
  materials, and any cards not currently equipped.
  Standard MMO inventory.
- **Deck** holds your equipped Hand (10 active + 5 passive).
  It is **separate from
  inventory** and is only changed at spirits (see Spirit System).
  Cards are soul;
  everything in inventory is body.

## Spirit System

Spirits are the heart of the game — part bonfire, part bank, part progression tree.
They grant your **hand slots** and your death-time **attunement slots** (see below),
so spirit progression is the spine of character power.

### Location Spirits (fixed, public)

- Bound to places in the world; anyone can use them.
- Generally **higher level** than personal spirits.
- Role: **power & access** — swapping high-rarity cards (only legendary spirits can swap legendary cards), card merging, possibly local buffs.
- Legendary spirits are very rare → pilgrimage destinations, natural social hubs.

### Personal Spirit (travels with you)

- Always with you; generally **lower level**.
- Lower-level spirits may allow swapping only **minor cards** while traveling.
- Role: **death insurance** (see Death Rules).
- Survives your death — it is the meta-progression anchor across lives.

### Spirit Leveling — Card Sacrifice

- Feed cards to a spirit to level it up.
  A sacrifice that **adds up over time**.
- Burning a rare/legendary card for permanent spirit progression is a deliberate, weighty decision.

## Social & Group Play

- **Groups:** 2–6 players, cooperative (PvE).
  Shared XP/loot rules TBD.
- **Alliances:** up to 6 groups federated (≤ 36 players) for large content (world
  bosses, raids).
- Grouping is over **active characters**; a member who dies (permadeath) drops from
  the group and rejoins with their next character.
- **Permadeath × grouping (open):** does a group get any revive, or is death final
  even in a party?
  A rez softens the core stakes; no rez makes group content brutal.
  Possible middle: revive only at a spirit, or at a steep cost.
  To be decided.
- **Persistent social identity** (guild names, rosters that survive death) should
  live at the **account** level, separate from the transient character-level group/
  alliance.
  Whether alliances are transient coalitions or persistent guilds: open.

## Death Rules (souls-like, softened)

- **Gear:** always lost.
  No exceptions. (This is the permanent economy sink.)
- **Cards:** preserved via your personal spirit's **attunement slots** — attuned
  cards are _guaranteed_ to survive death; everything un-attuned is lost.
  This
  replaces rage-inducing RNG with a souls-style loadout decision made _before_ you
  venture out.
- **Attunement slots are rarity-tiered.** Your spirit grants slots bucketed by
  rarity (e.g. a few common slots, fewer rare, one legendary at high spirit level),
  so you **cannot hoard 10 legendaries** through death — you choose _which_
  legendary is worth saving.
- Slot counts scale with personal-spirit level, so feeding/leveling your spirit
  directly buys death-insurance capacity.
- PvE-only prevents high-level players from griefing permadeath characters.

## Opening / Tutorial

No amnesia trope.
Instead:

> You had a falling-out with your previous spirit.
> Furious, it **purged all your cards and threw you off a cliff**.
> You wake at the bottom with nothing.

- Explains the empty start AND teaches the spirit system in the first 30 seconds.
- The angry spirit is a recurring character: rival, questline, possible late-game reconciliation (win back your original purged cards).
- Early tutorial: find/bond a weak stray personal spirit.

## Economy Notes

- Gear destruction on death → permanent demand for crafting and gear drops.
- Card merging + spirit sacrifice → card sinks; duplicates always have value.
- **Trading:** cards are freely tradeable (every card has value to _some_ build —
  see emergent classes).
  Gear trading rules TBD.
  No card _drops_ on death (loss only, mitigated by spirit retention).

## Leveling & Progression

### Philosophy

Permadeath is only fun if _getting back_ is fast.
The frustration equation is:
**time lost on death = hours to re-reach prior level**.
The spirit system
covers what you _keep_ (cards); the leveling design covers how fast you _recover_.
Both must work together to make death feel tense rather than catastrophic.

### Level Cap: 50

Three arcs, each with a distinct feel:

#### Levels 1–10: The Foundation (tutorial arc)

- Estimated time first playthrough: ~3–5 hours.
- Introduces combat, the spirit system, card equipping, and the first zone.
- **Skippable on all subsequent lives** once completed on the account.
  Skipping starts the character at level 10 with a curated starter kit
  (basic gear set, a couple of common cards, a weak personal spirit bond) —
  not comfortable, just past the tutorial floor.
- Unlocks: 4 active / 2 passive hand slots, spirit bonding, first open zone.
- Level 10 is a **soft account milestone**: the game remembers you did this.

#### Levels 10–30: The Awakening (open-world arc)

- Estimated time: ~15–20 hours from level 10.
- New zones open roughly every 5 levels (mix of soft recommendation and hard
  gates for a few key regions).
- Card pool expands significantly; uncommon and rare cards become attainable.
- Hand slots grow toward 8 active / 4 passive via spirit leveling.
- This is the heart of the game — most deaths happen here; most re-runs start here.

#### Levels 30–50: The Deep Game (endgame arc)

- Estimated time: ~25–35 hours from level 30.
- Dungeons become the primary driver (see Dungeons below).
- Epic and legendary cards require level 35+ to equip.
- Full hand (10 active / 5 passive) unlocked around level 40–45 via spirit.
- At 50, open-world content is "solved" — dungeons are the endless endgame loop.

### XP Curve Design Goals

- Levels 1–10: fast and forgiving.
  Each level feels like a few quests.
- Levels 10–30: medium pace.
  A level per solid play session.
- Levels 30–50: slower, but dungeon rewards make it feel earned not ground.
- **After death, re-reaching your prior level should take ~40–50% of the
  original time** — you know what you're doing, the tutorial is skipped,
  and your attuned cards give you a head start.

### Dungeons

Instanced group (or solo) content separate from the open world.

**Difficulty tiers** (names provisional):

1. **Delve** (recommended level 20+) — introductory dungeon, normal drops.
2. **Vault** (recommended level 30+) — rare/epic drops, punishing mechanics.
3. **Abyss** (recommended level 40+) — epic/legendary drops, brutal.
4. **Hollow** (level 50 only) — endgame loop; legendary gear, best spirits.
   Multiple Hollow tiers (Hollow I → Hollow V, etc.) give infinite scaling
   goals post-cap.
   Higher tiers require a "Hollow Key" (rare drop) to enter.

**Permadeath in dungeons:** death is still permanent.
However, two softeners
apply _inside dungeons only_ (see Revival Systems below).

**Why dungeons solve the endgame:** gear is always lost on death.
A level-50
player running Hollow V for legendary gear drops has the same gear-churn
incentive as a level-20 player.
The economy never stagnates.

### Revival Systems

Two safety valves — both deliberately scarce and dungeon-friendly:

**Soul Ember** _(rare consumable, non-tradeable)_

- A one-time-use item that prevents the _next_ death this life.
- On what would be a killing blow: HP locks at 1, the Ember is consumed.
- Rare world/dungeon drop; cannot be bought, sold, or traded.
  Non-tradeable prevents a pay-to-not-die market.
- Carrying one is a meaningful inventory decision (it takes a slot).
- Effect is visible to group members ("Ember-lit" status) — no surprises.

**Revive** _(legendary passive card — healer archetype only)_

- A passive TRIGGERED card that activates on a group member's death.
- Pulls them back with partial HP once per dungeon run (long internal cooldown).
- **Self-revive is explicitly impossible** — forces co-op identity.
- Only fires inside instanced dungeons; has no effect in the open world.
- Equipping it costs a precious passive slot — a real hand trade-off.
- This is the primary mechanical identity for a support/healer build.

### Account-Level Milestones

Permanent progress that survives every death — _access and cosmetics, never power_:

- **Tutorial skip** — unlocked at level 10 (first life only).
- **Race unlocks** — additional races become available as you hit account XP
  thresholds (total XP across all lives).
  Starting race is always available.
- **Cosmetics** — titles, spirit appearances, character skins earned by
  account milestones.
  Pure vanity; never affect power.
- These exist so a long-term player feels that _nothing is ever fully wasted_.

> **Note — no legacy vault:** the personal spirit is the sole cross-death retention
> mechanism.
> The spirit's `bond_xp` accumulates across every life and never resets,
> so a veteran player's spirit is meaningfully stronger than a fresh account's —
> this _is_ the meta-progression.
> A separate vault would duplicate that function.

## Open Questions

- World structure: zone layout, exact level gates, spirit territories as zone gates.
- Gear trading rules (cards are tradeable; gear TBD).
- Alliances: transient coalition vs persistent guild; persistent identity at account level.
- Shared XP/loot rules for groups in dungeons.
- Exact Soul Ember drop rate and spawn sources (owned by item-balancer).
- Concrete balance numbers (stat conversion rates, avoidance caps, XP curve, scaling
  curves, gear stat budgets, drop rates) — all pending playtest.
- Equipment system: content pipeline + server tables + combat wiring now
  implemented (content/equipment.json → validated → seedItems →
  ItemDefinition/ItemInstance/EquippedItem tables; equipItem/unequipItem
  reducers with proportional HP/MP rescaling; effective_stats = race base
  - gear, computed in rules/stats.ts and wired into resolveHit for both
    damageEnemy and enemy casts; item drops on enemy death (ITEM_DROP_CHANCE,
    rarity-weighted + min_level-gated by killer's level), independent of the
    card roll; gear destroyed on death).
    Not yet
    implemented: a real Race table (computeRaceBase is a single hard-coded
    stub), ward-passive card stats feeding effective_stats, set bonuses,
    difficulty-based item rarity scaling, and armor weight classes as a wear
    gate check (still bias-only per design — no code path needs one yet).
    Client inventory/equip UI now exists: InventoryPanel (I key, bag grid
    with rarity/armor-weight/slot badges, hover tooltips, click-to-equip/
    replace/unequip) and CharacterSheet (P key, 12-slot body-silhouette
    equipment diagram + grouped stat totals with race-base-vs-gear-bonus
    breakdown). item_instance/equipped_item are now public tables (no
    row-level security yet — see ARCHITECTURE.md) so the client can
    subscribe to them.
    Blocks: gear economy at scale, itemized build
    identity.

**Resolved:** control scheme (cursor-aimed, PoE-style) · weapon = geometry (range

- width) + stat carrier · cards weapon-agnostic with scaling tags (emergent classes)
  · cards freely tradeable · no card drops on death · full equipment slot list · tech
  stack · hand starts 2/1, capped 10/5, slots granted by **spirit** not character
  level · some cards have min-character-level to equip · death retention via
  **rarity-tiered attunement slots** · PvP: none at launch (arena → open-world later)
  · evasion = glancing/partial with low caps · armor weight classes (cloth/chain/plate,
  bias only, no wear restriction) · **level cap 50** · **tutorial skip at level 10
  (account unlock)** · **Soul Ember** (rare non-tradeable revival consumable) ·
  **Revive card** (legendary passive, group-only, dungeon-only, healer archetype) ·
  **dungeons with 4 difficulty tiers + Hollow endgame scaling** · **account milestones**
  (tutorial skip, race unlocks, legacy vault, cosmetics — access/vanity, never power).
  · cards freely tradeable · no card drops on death · full equipment slot list · tech
  stack · hand starts 2/1, capped 10/5, slots granted by **spirit** not character
  level · some cards have min-character-level to equip · death retention via
  **rarity-tiered attunement slots** · PvP: none at launch (arena → open-world later)
  · evasion = glancing/partial with low caps · armor weight classes (cloth/chain/plate,
  bias only, no wear restriction) · content pipeline: cards.json → Zod validator →
  unit tests → SpacetimeDB seeder (slug as idempotency key) · enemy telegraph system
  (cast bar + ground AoE indicator, client visual only, server decides damage) ·
  enemy chase AI (aggro/deaggro ranges, chase speed < player speed so a chase is
  always escapable, HP regen on reset) · card drops (enemy death → CARD_DROP_CHANCE
  (25%) roll, rarity-weighted + min-level-gated by killer's level, legendary
  excluded from trash-mob drops → cardDrop row → 60s despawn; pickup via F key
  within 80px) · collection panel (C,
  always accessible, equip greyed outside spirit range) · spirit panel (E,
  proximity-gated, unlocks hand management) · death summary screen (shows survived
  vs lost cards) · held-key quick cast with live cone indicator · equipment
  content pipeline (equipment.json → Zod validator → unit tests → seedItems,
  slug as idempotency key — mirrors the cards.json pipeline exactly) with
  6 starter items (worn-dagger, apprentice-staff, leather-cap, iron-chestplate,
  traveller-boots, spirit-focus) for the vertical slice · gear stats wired
  into combat (effective_stats = race base + equipped gear, drives
  resolveHit for both player attacks and enemy casts; bare weapon swings
  use the weapon's own weaponDamage stat) · equip/unequip with proportional
  HP/MP rescaling · item drops (ITEM_DROP_CHANCE (20%) per enemy death,
  rarity-weighted + min-level-gated, same despawn/pickup lifecycle as card
  drops) · gear destroyed on death ("gear is your body," no exceptions) ·
  inventory panel (I, bag grid with rarity/armor/slot badges + hover
  tooltips + click-to-equip) · character sheet (P, 3-column/7-row paper-doll
  equipment diagram — weapons top row, earrings flanking head, rings
  flanking hands, body line down the center — + grouped stat totals with
  tooltips) · **XP-from-kills progression loop** (enemy.xpReward, 25 per
  zone-1 kill, granted via a shared `_grantXp` helper; character.xp and
  account_progress.total_xp_all_lives both update, the latter surviving
  death; level-up refills HP/MP and stamps `lastLevelUpAt` for the client's
  golden-flash/"LEVEL N" VFX; client XP bar + floating "+N XP" text) ·
  **level-gated drops** (both card and item drop pools filtered to the
  killer's level before the rarity-weighted pick, so e.g. a level-5-gated
  card can't drop for a level-1 character).

## Tech Stack (decided)

- **Client:** TypeScript + **Phaser** (2D / 2.5D isometric).
  Browser-based.
  Fixed camera, cursor-aimed controls.
- **Game backend:** **SpacetimeDB with TypeScript server modules** (added in v1.6, currently beta).
  - Pros: one language end-to-end; networking, real-time sync, subscriptions, persistence built in; proven at MMO scale (BitCraft Online runs on a single module); hot-swappable modules; auto-generated typed client bindings.
  - Risks: TS modules are beta (performance caveats); architecture lock-in to the reducer/transaction model; metered cloud compute (self-hosting as escape hatch).
  - **Hedge:** keep reducers thin; put game-rules logic in plain TS functions so modules could be ported to Rust/C# if needed.
- **Login / auth server:** a separate, conventional service — owns accounts,
  sessions, token issuance.
  The game module trusts a verified identity, not raw
  credentials.
  Kept separate for security surface, independent scaling, swappable
  auth, and to keep credential handling out of the beta runtime. (See the
  `architect` skill for the seam.)
- Previously considered and dropped: jMonkeyEngine client (3D too heavy for solo dev), Java backend with virtual threads (SpacetimeDB removes the concurrent-I/O problem virtual threads would have solved).

## Next Steps

1. Data model: cards, decks/hands, spirits, players, items (SpacetimeDB tables + reducers).
2. Vertical slice: one zone, a few cards, one location spirit, death + retention loop.
3. Phaser client: movement, ability casting from hand, basic combat readability.
