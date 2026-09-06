# Testing Contract

Define your project's mandatory testing rules.

## 0. Write the test without being asked — but only the meaningful one

Adding or changing behavior is not done until it has the test that actually
proves it, at whichever of the two levels below genuinely covers it — this
is part of the task, not a separate follow-up request.
Decide the level the
same way this contract's other sections do:

- New or changed **pure logic** (a rule function, a validator, a client-side
  duplicate) → a **unit test** in the same pass, per Section 2's coverage
  rule.
- New or changed **reducer behavior that only shows up end-to-end** (an
  ownership/ordering/cross-table effect an HTTP call must exercise, not a
  pure function) → an **integration test**, per Section 3, when the
  scenario is concrete enough to write one deterministically (a real
  black-box sequence of calls, not "mock the database").
  Prefer adding one
  `it` to an existing `describe` in the relevant
  `*.integration.test.ts` file over starting a new file, if one already
  covers the same feature area.

**Meaningful only — this is a ceiling, not a floor to hit:**

- Do not write a test whose failure would tell a reader nothing they didn't
  already know from the type system or an obvious code read (a getter, a
  trivial passthrough, restating a Zod schema's own type).
- Do not add an integration test for something the unit suite already
  proves — reach for the integration suite only when the reducer's own
  wiring (not the pure function it calls into) is what's actually being
  verified.
- Do not pad a PR with tests for pre-existing, unrelated code just because
  the file was already open — same "Change Scope Discipline" this
  project's `003-developer-guidelines.md` already states for the code
  itself applies to the tests written alongside it.
- When a change genuinely has nothing worth testing this way (a comment, a
  rename, a doc, a pure-refactor with no behavior change), say so rather
  than inventing a test to look complete.

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

## 5. Anchoring: `verifies()` wraps the `it`, never the other way round

The anchor is a wrapper _around_ the test declaration, not an argument _to_
it:

```ts
verifies(SwTraceables.SW_036_XP_FALLS_OFF_LINEARLY_BETWEEN..., () => {
  describe('computeXpReward', () => {
    it('awards base XP at equal levels', () => {
      expect(computeXpReward(BASE, 5, 5, CFG)).toBe(BASE);
    });
  });
});
```

- **The trap:** `it(name, verifies(ids, () => { ... }))` looks right and is
  caught by nothing in the normal loop.
  Arguments evaluate before the call, so `verifies()` runs the block during
  _collection_ and then hands `it` the `void` it returns.
  vitest sees a test with no body, downgrades it to **todo**, prints it in
  green, and counts it as not-failing.
  The clew anchor still resolves, so `clew coverage` reports the spec as
  verified by a test that never ran.
- **The guard:** `vitest.noTodoTests.ts` is registered as a reporter in both
  `vitest.config.ts` and `vitest.integration.config.ts` and fails any run that
  collected a todo test, naming each offender by `file:line`.
  It applies locally and in CI, across both suites — there is no supported way
  to leave a green todo in this repo.
- A genuinely unwritten test belongs in `docs/spec/` as a spec without a
  `verifies` anchor, where `clew coverage` reports it, not as a placeholder in
  the suite.
  `it.skip` is deliberately _not_ flagged: skipping is an explicit, visible
  choice, whereas todo is what a missing body looks like.
