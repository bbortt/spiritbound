# Testing Contract

Define your project's mandatory testing rules.

## 1. Test Files & Naming

- **Runner:** `vitest`, the only test framework in this repo (see
  `004-technology-contract.md`) — two separate suites, two separate configs:
  - **Unit suite** (`vitest.config.ts`, root script `pnpm vitest` /
    `vitest run`): fast, no external dependencies, excludes the integration
    suite.
  - **Integration suite** (`vitest.integration.config.ts`, root script
    `pnpm run vitest:integration`): black-box HTTP tests against a live,
    published SpacetimeDB instance — see "Integration tests" below.
- **Location:** colocated with the source file, same directory, suffix
  `*.test.ts` (e.g. `content/cards.test.ts` next to `content/loader.ts`).
  No separate `__tests__`/`test/` tree.
  The integration suite is the one
  exception: `spacetimedb/integration/*.integration.test.ts`, since it tests
  the published module as a whole rather than one source file.
- **Naming:** the test file's basename matches the module it tests
  (`levelCurve.ts` → `levelCurve.test.ts`), not the behavior under test —
  `describe`/`it` blocks name the behavior instead.
  Integration test files
  are named after the _feature_ they exercise end-to-end (e.g.
  `death.integration.test.ts`), since there's no single source file they
  mirror.

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
    architecture (see `docs/spec/architecture.md`) and are not unit-tested
    directly — their pure logic is covered by the rule-function tests
    (previous bullet).
    Their own wiring (ownership checks, cross-table
    effects, the actual HTTP-level rejection behavior) is instead covered by
    the integration suite below, where a real end-to-end scenario justifies
    the cost of standing up a live instance — this is not a requirement to
    integration-test every reducer exhaustively.

## 3. Integration tests

`spacetimedb/integration/*.integration.test.ts` (config:
`vitest.integration.config.ts`, script: `pnpm run vitest:integration`) are
black-box tests over real HTTP against a live, published SpacetimeDB
instance — the same `POST /v1/identity` → mint token →
`POST /v1/database/spiritbound/call/<reducer>` → `POST
/v1/database/spiritbound/sql` loop used to verify features manually during
development, automated instead of re-typed by hand each time.

- **Precondition, not orchestrated by the suite:** a local instance must
  already be running and published (`pnpm run db:start` then
  `pnpm run spacetime:publish:local`, or point `SPACETIME_HOST` at one
  that's already up).
  The suite's own `beforeAll` fails fast with a clear
  message if nothing answers, rather than hanging; it does re-run
  `seedCards`/`seedItems` itself (idempotent, upsert-by-slug — safe even if
  the instance was already seeded).
- **Test isolation:** every test mints its own fresh identity and moves its
  character to a private, globally-unique world position (seeded from
  `Date.now()`, not a per-process counter — a fixed counter would hand out
  the same coordinates a previous run already used, landing a fresh
  character on that run's still-alive leftover enemies).
  Tests locate their
  own rows by that position, not by decoding the wire Identity encoding.
- **Drop-dependent scenarios** (an item, or a card of a specific rarity)
  have no deterministic "grant" reducer — the only black-box path is
  killing enemies with a real, already-seeded card until the probabilistic
  roll succeeds (`rules/drops.ts#CARD_DROP_CHANCE`/`ITEM_DROP_CHANCE`),
  capped at a generous retry count so a real regression in the roll fails
  the test instead of hanging.
  This is a legitimate, bounded retry loop —
  not the "no reliance on random rolls" rule in `Test Design` below, which
  is about the _unit_ tests over the pure roll functions themselves.
- **SQL quirk:** SpacetimeDB's SQL endpoint rejects `ORDER BY ... LIMIT`
  together ("Unsupported"); "give me the newest matching row" queries fetch
  the WHERE-filtered set and pick the max id client-side instead (see
  `spacetimedb/integration/helpers.ts#latestBy`).
  Enum-typed columns
  (`rarity`, etc.) also could not be filtered with a plain string literal in
  SQL — where a test needs to know an enum value (e.g. a dropped card's
  rarity), derive it from the content file's own stable id scheme instead
  of querying for it.
- Anchor each test to the spec(s) it verifies the same way unit tests do
  (`verifies(...)`, imported from `src/clew/traceables/clew`).

## 4. Test Design

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
