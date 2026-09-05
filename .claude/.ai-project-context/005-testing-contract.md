# Testing Contract

Define your project's mandatory testing rules.

## 1. Test Files & Naming

- **Runner:** `vitest`, the only test framework in this repo (see
  `004-technology-contract.md`).
  Run via `pnpm vitest` (root script,
  `vitest run`) — no separate `vitest.config.*` exists; defaults apply.
- **Location:** colocated with the source file, same directory, suffix
  `*.test.ts` (e.g. `content/cards.test.ts` next to `content/loader.ts`).
  No separate `__tests__`/`test/` tree.
- **Naming:** the test file's basename matches the module it tests
  (`levelCurve.ts` → `levelCurve.test.ts`), not the behavior under test —
  `describe`/`it` blocks name the behavior instead.

## 2. Running & Coverage

- **How the suite runs:** `pnpm vitest` from the repo root; picks up every
  `*.test.ts` across the workspace (root `content/`, and any added under
  `spacetimedb/` or `client/`).
- **Coverage expectations — split by kind, not a blanket percentage:**
  - **Pure logic** (SpacetimeDB rule functions in `spacetimedb/src/rules/*.ts`,
    client-side duplicated math in `client/src/effectiveStats.ts` and
    `client/src/levelCurve.ts`, content validators in `content/*.ts`) —
    **must** have vitest unit tests.
    This is the code clew's spec coverage
    is expected to reach 100% on.
  - **Phaser canvas-rendering/VFX code** (`client/src/scenes/GameScene.ts`,
    `client/src/ui/*.ts`) — no unit-test harness is mandated; there is no
    DOM/canvas mock in this repo and none is being added speculatively.
    Observable behavior here is still specified (SW specs) and anchored to
    the code, but verified by manual/browser QA (see
    `docs/spec/architecture.md`), not a `verifies` test anchor. **When a
    piece of this code is pure calculation or decision logic with no Phaser
    dependency** (e.g. "which hand slots changed between two states,"
    "what layout position does this equipment slot map to"), it must be
    extracted into its own plain-TypeScript module and unit-tested there —
    do not let logic hide inside a Scene/Panel class just because the file
    it started in has no tests.
    This is an ongoing refactoring expectation
    for new UI work, not a one-time pass.
  - **Reducers** (`spacetimedb/src/index.ts`) are thin shells by
    architecture (see `docs/spec/architecture.md`) — they are exercised
    indirectly through the rule-function tests and through manual/HTTP
    integration checks (see `003-developer-guidelines.md` for the local
    Docker SpacetimeDB dev loop), not unit-tested directly as reducers.

## 3. Test Design

- Assert **observable behavior**, not internals: a rule function's output
  for given inputs, a validator's accept/reject decision, a curve's
  monotonicity/boundary values — not private helper call counts.
- Tests must be deterministic — no reliance on wall-clock time, random
  rolls, or network/Docker state.
  Where a rule function consumes
  randomness (e.g. drop-rate rolls, rarity weighting) or a timestamp, the
  function must take it as a parameter so tests can supply a fixed value —
  never reach for `Math.random()`/`Date.now()` inside a function under
  test.
- One `describe` block per exported function/behavior; cover the normal
  path, the documented edge cases (empty pool, boundary level, zero/negative
  input), and any case a `BALANCE.md`/`GAME_DESIGN.md` note calls out as a
  deliberate design choice (e.g. "legendary weight is 0 by design").
