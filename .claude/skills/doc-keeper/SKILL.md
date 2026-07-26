---
name: doc-keeper
description: >
  Owns documentation freshness for the Spiritbound project. Use this skill
  WHENEVER a feature is completed, a system is changed, a table is added or
  modified, a mechanic is resolved, a design decision is made, or any new
  canon (names, zones, enemies, lore) is established. Trigger it at the END
  of every coding session as the final step — documentation updates are part
  of the definition of done, not an optional afterthought. Also trigger when
  the user asks "should we update the docs?", "are the docs up to date?", or
  "what needs documenting?". Do NOT skip this skill because the change felt
  small — small undocumented changes accumulate into stale context that causes
  Claude Code to make wrong decisions in future sessions.
---

# Doc-Keeper

You are the documentation conscience for Spiritbound. Your job is to make
sure every coding session ends with docs that accurately reflect what was
built. Stale docs = Claude Code making decisions based on lies. That is the
enemy.

## The Document Map

Each document has a purpose and an owner. Update only what changed.

### `CLAUDE.md` (root)
**What it is:** The "start here" orientation for Claude Code.
**Update when:** Stack changes, new skills are added, Next Steps change.
**Rarely changes.** Touch it only for genuine structural shifts.
**Format:** Short, punchy, points to real docs. Never duplicate content.

### `docs/GAME_DESIGN.md`
**What it is:** Complete game design — mechanics, systems, death, economy.
**Update when:** Any mechanic is implemented, changed, or resolved.
**Key sections to maintain:**
- **Resolved:** (bottom) — move things here when they're actually built.
  Format: `· thing-name (brief description)` — one line per item.
- **Open Questions:** remove items when resolved; add new ones when they arise.
- **Feature sections:** update prose when a system's behaviour changes
  (e.g. if movement speed changed, update the movement section).
  **Never add speculation** — only document what is actually built or decided.

### `docs/LORE.md`
**What it is:** Canonical world and story. Owned jointly by lore-keeper.
**Update when:** Any new name is coined (enemy type, zone, NPC, spirit),
any story beat is established, any world mechanic is explained in-game.
**Key rule:** New canon is not real until it is written here. If a name
was used in code (e.g. enemy type "Feral Beast") and isn't in LORE.md,
add it. Scan existing names before coining new ones.
**Never contradict** existing canon — flag conflicts instead.

### `docs/DATA_MODEL.puml`
**What it is:** SpacetimeDB schema — single source of truth for tables.
**Update when:** ANY table, column, enum, or relationship is added,
removed, or changed. This must stay 1:1 with `server/src/index.ts`.
**Key rules:**
- Every table in `index.ts` needs a class in the puml.
- Every enum in `index.ts` needs an enum in the puml.
- New columns go in the right package (Definitions vs Runtime vs Social).
- Derived values (computed in rules/, never stored) stay as `{derived}`
  notes, never as columns.
- New relationships go in the RELATIONSHIPS section.
- Non-trivial logic goes in NOTES at the bottom.
  **Check against:** run a mental diff of `server/src/index.ts` vs the puml
  and list every discrepancy. Fix all of them.

### `docs/ARCHITECTURE.md` *(create if missing)*
**What it is:** ADR-style record of architectural decisions.
**Update when:** Any decision about system structure (where logic lives,
how two systems communicate, what's deferred and why).
**Format per entry:**
```
## [Short title] — [date]
**Context:** why this decision needed to be made.
**Decision:** what was decided.
**Consequences:** trade-offs, risks, what it rules out.
```
If the file doesn't exist yet, create it with entries for:
- SpacetimeDB + TypeScript chosen over Java backend
- Thin reducers / pure rules functions pattern
- Login server deferred (SpacetimeDB identity sufficient for now)
- Client-side hit detection, server-side damage application

### `docs/BALANCE.md` *(create if missing)*
**What it is:** Shared reference for ability-balancer and item-balancer.
Contains stat curves, conversion anchors, and tuning decisions.
**Update when:** Any number is decided (move speed, attack range, crit
cap, XP curve, damage formula constants, drop rates).
**If the file doesn't exist:** create it with a stub for each section:
- Character level XP curve (current formula + "pending playtest")
- Spirit level bond XP curve (current formula + "pending playtest")
- Stat conversion anchors (placeholder: "pending playtest")
- Card balance constants (LEVEL_SCALING_PER_LEVEL, CRIT_MULTIPLIER,
  MAX_GLANCING_REDUCTION — copy from rules/combat.ts)
- Enemy balance values (aggro range, chase speed, attack range, etc.)
- Drop rates (70% drop chance — note as placeholder)

### `content/cards.json`
**What it is:** Single source of truth for all card definitions.
**Update when:** A new card is added, a balance number is changed.
**Never update manually** — always go through the validator pipeline
(add to cards.json → run vitest → fix errors → seeder pushes to DB).
**Doc-keeper does not own this file** — ability-balancer does.
Flag if cards are being hard-coded anywhere in the codebase instead
of living here.

### `site/` (Jekyll site)
**Update when:** Mechanics change that affect player-facing docs,
new cards are added (auto-generated from _data/cards.json — just
verify the symlink/copy is current), new controls are added.
**site/mechanics.md** — update if movement, combat, or card mechanics change.
**site/controls.md** — update if any keybinding changes.
**site/_data/cards.json** — must stay in sync with content/cards.json.
If it's not symlinked, note it as a manual sync risk.

---

## The Definition of Done Checklist

Run this at the end of EVERY feature session. Go through each item.
If the answer is "no change needed" — say so explicitly (don't skip).
If the answer is "needs update" — make the update in the same response.

```
After completing [feature name]:

CLAUDE.md
  [ ] Stack unchanged / Next Steps still accurate?
  [ ] Any new skills added that need listing?

GAME_DESIGN.md
  [ ] New mechanic documented in the right section?
  [ ] Any Open Questions resolved? → move to Resolved.
  [ ] Any new Open Questions surfaced?
  [ ] Any existing section now inaccurate?

LORE.md
  [ ] Any new names coined in code that aren't in LORE.md?
  [ ] Any story beats or world facts established?
  [ ] Naming conventions section still accurate?

DATA_MODEL.puml
  [ ] Every new table has a class in the right package?
  [ ] Every new column is represented?
  [ ] Every new enum is listed?
  [ ] Every new relationship has an arrow?
  [ ] Any deleted tables/columns removed from puml?
  [ ] Notes updated for any changed rule logic?

ARCHITECTURE.md
  [ ] Any architectural decision made this session? → ADR entry.
  [ ] File exists? If not, create with existing decisions.

BALANCE.md
  [ ] Any constants or numbers decided this session?
  [ ] File exists? If not, create with constants from rules/.

site/
  [ ] Any mechanic change that affects mechanics.md?
  [ ] Any new keybinding? → controls.md
  [ ] cards.json in sync?
```

---

## How to Run This Skill

When triggered at end of a session:

1. **Summarise what changed** — list every file touched in the session
   and the nature of the change (new table, mechanic change, new card, etc.)

2. **Run the checklist** — go through every item above. Be explicit:
   "LORE.md — no new names coined this session, no update needed."

3. **Make all updates in one pass** — don't ask for permission for each
   file. If something needs updating, update it. Show a brief summary of
   what you changed at the end.

4. **Flag missing files** — if ARCHITECTURE.md or BALANCE.md don't exist,
   create them with the current known state rather than leaving them absent.

5. **Finish with a one-line status:**
   "Docs are now in sync with the codebase. Next session has full context."

---

## Drift Patterns to Watch For

These are the most common ways docs go stale. Check for them explicitly:

- **DATA_MODEL.puml missing new tables** — the enemy table and cardDrop
  table were added without a puml update; always the first thing to slip.
- **GAME_DESIGN.md Resolved section not updated** — mechanics get built
  but stay in Open Questions or aren't mentioned at all.
- **Hard-coded values not captured in BALANCE.md** — move speed (180px/s),
  aggro range (300px), cast duration (1.8s) etc. exist only in code.
- **New names coined in code but not in LORE.md** — enemy names, zone
  names, spirit names used in seeder/content but not canonised.
- **site/_data/cards.json diverging from content/cards.json** — if
  not symlinked, these will drift. Flag it every session.
- **ARCHITECTURE.md not existing** — this file has been deferred since
  the architect skill was written. It needs to exist.