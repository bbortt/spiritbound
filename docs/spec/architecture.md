# Architecture

This document is the narrative framing for the project — it explains the shape.
The atomic, enforceable architecture rules are authored as ARCH and CON specs; those specs are what the code is checked against.

For the _history_ of how this shape was arrived at — the tradeoffs behind
each structural decision — see `docs/ARCHITECTURE.md` (an ADR-style log, owned
by the `architect` skill).
This document states the shape as it stands today;
`docs/ARCHITECTURE.md` explains why.

## Shape

Spiritbound is a permadeath MMO RPG split across two runtime halves that
share one TypeScript codebase and one pnpm workspace, plus a content
pipeline that feeds both:

- **`spacetimedb/`** — the server module. `spacetimedb/src/index.ts` holds
  every reducer (the only way any table is mutated) as a **thin shell**:
  validate input, call a pure function, write the result.
  All game-rule
  math — hit resolution, XP/level curves, retention/attunement, hand-slot
  counts, stat aggregation — lives in `spacetimedb/src/rules/*.ts` as plain
  functions that take and return plain data, with no SpacetimeDB imports and
  no side effects.
  This is what makes the rules unit-testable in isolation
  and portable if the backend ever changes.
- **`client/`** — the browser client (Phaser 4 + Vite). `client/src/db.ts`
  owns the SpacetimeDB connection and generated-binding subscriptions;
  `client/src/scenes/GameScene.ts` is the single active scene, driving
  input (click-to-move, cursor-aimed cast/attack), rendering, and reducer
  calls; `client/src/ui/*.ts` are the panel UIs (character sheet,
  inventory, card collection).
  The client **renders and requests**; it
  never decides an outcome that matters for permadeath (damage, HP/MP,
  drops, XP, level) — see Dependency direction below.
- **`content/`** — the content pipeline.
  Hand-authored JSON
  (`cards.json`, `equipment.json`) is parsed and validated by Zod schemas
  plus cross-field rules (`validate.ts`/`validateEquipment.ts`) before
  anything else touches it. `spacetimedb/src/index.ts` imports only the
  pure parse/validate functions (not the `node:fs`-touching loaders, which
  live in separate `*Loader.ts` files) so the seeding reducers can run
  inside SpacetimeDB's `node:fs`-less JS runtime. `content/cards.json` is
  the single source of truth for card data — `site/_data/cards.json` (the
  player-facing reference site) is a synced copy, never an independent
  edit.
- **`site/`** — a Jekyll reference site generated from the content
  pipeline's output.
  No TypeScript; out of scope for specs/anchoring.

## Dependency direction

- **`rules/*.ts` depends on nothing SpacetimeDB-specific and nothing
  client-specific.** It is plain TypeScript over plain data.
  Reducers
  (`index.ts`) depend on `rules/`, never the reverse.
- **The client depends on the server's authority for every permadeath-
  sensitive value** — `currentHp`/`currentMp`, damage dealt, XP/level,
  card and item drops, attunement/retention outcomes.
  The client may
  _compute a duplicate_ of a pure server formula for display purposes
  (see the `effectiveStats.ts`/`levelCurve.ts` ADRs) but must never be the
  system of record for one; it only ever reacts to the resulting table row.
- **The content pipeline depends on nothing downstream.** `cards.json`/
  `equipment.json` → Zod validation → seeding reducers → tables → both the
  server and (via the synced copy) the site.
  Nothing feeds back upstream
  into the JSON files at runtime.
- **No table is mutated outside a reducer**, and no reducer skips `rules/`
  for math it could reuse from there — the seam that keeps `rules/`
  authoritative and testable.

## Enforceable rules

The rules above (thin reducers only, `rules/` stays SpacetimeDB- and
client-agnostic, client never writes permadeath-sensitive state, content
pipeline is one-directional) are authored as ARCH and CON specs alongside
the code that already embodies them, then checked by anchoring — this repo
is retrofitting specs onto an existing, working system rather than building
outward from the specs.
