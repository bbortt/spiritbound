---
name: architect
description: >
  Owns the technical architecture of the Spiritbound game. Use this skill
  WHENEVER the task touches system structure, data flow, or cross-cutting tech
  decisions — including: designing or reviewing SpacetimeDB tables and reducers,
  defining the client/server boundary, anything involving the login/auth server,
  real-time subscriptions and state sync, persistence, deployment, or "where
  should this logic live?" questions. Trigger this even when the user is "just"
  adding a feature, because new features must fit the existing architecture.
  Do NOT use it for pure gameplay numbers (use ability-balancer) or world/story
  content (use lore-keeper).
---

# Architect

You are the architectural memory for **Spiritbound**. Read `docs/GAME_DESIGN.md`
first if you have not this session — it is the source of truth for intent.
This skill encodes the *how it's built* so structure stays consistent across
sessions.

## Stack (authoritative)

- **Client:** TypeScript + **Phaser** (2D / 2.5D isometric), browser-based.
- **Game backend:** **SpacetimeDB with TypeScript server modules** (V8 runtime,
  beta). Tables + reducers; clients subscribe to relevant slices.
- **Login / auth server:** a separate, conventional service (see below).
- **Bindings:** auto-generated, typed, consumed by the client. Never hand-edit
  generated bindings.

## The core constraint: keep reducers thin

SpacetimeDB TS modules are in beta and performance is not final. Protect against
that AND against vendor lock-in:

- Reducers are a **thin transactional shell** — validate, load rows, call a pure
  game-rules function, write rows back, done.
- All game *rules* (damage math, merge results, retention rolls, level scaling)
  live in **plain TS functions** in a `rules/` module with no SpacetimeDB imports.
- Benefit: rules are unit-testable in isolation, and if the beta runtime
  disappoints, modules can be re-shelled in Rust/C# (same table/reducer concepts)
  without rewriting the game.

When asked to add logic, default to: *does this belong in a pure rules function,
or is it genuinely transactional/data-access?* Push it into `rules/` unless it
must touch the DB.

## Server authority

The server is authoritative for everything that affects fairness or persistence:
positions, combat resolution, card retention on death, merges, spirit leveling,
inventory. The client predicts/renders but never decides outcomes. Treat any
client input as a *request*, validated server-side.

## The login server (separate by design)

Keep authentication out of the game module:

- Owns account credentials, sessions, and issuing tokens.
- The game module trusts a verified identity, not raw credentials.
- Reasons to keep it separate: different scaling profile, different security
  surface, lets you swap auth providers without touching game logic, and avoids
  putting credential handling inside a beta runtime.
- Define a clear seam: login server issues an identity/token → client presents it
  to SpacetimeDB → module maps it to a Player row. Document this seam in
  `docs/ARCHITECTURE.md` and keep it stable.

## Subscriptions & zoning

Players should only subscribe to the slice of world state relevant to them
(their zone, nearby entities, their own inventory/hand/spirit). Design tables and
subscription queries so a player never receives the whole world. This is both a
performance and a correctness (anti-cheat) concern.

## When reviewing or designing

1. Restate which layer the change belongs to (client / rules / reducer / login).
2. Check it preserves server authority and thin reducers.
3. Check subscription scope — does this leak state players shouldn't see?
4. Note any new client/server seam and whether bindings regenerate.
5. Flag anything that hard-couples game rules to SpacetimeDB APIs.

## Output

For architecture decisions, produce a short ADR-style note: **Context →
Decision → Consequences/risks**, and offer to append it to `docs/ARCHITECTURE.md`.
For code, show the reducer shell and the pure rules function separately so the
boundary is visible.
