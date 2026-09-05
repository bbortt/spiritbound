# Technology Contract

The stack Spiritbound is built on.
One project, two runtime halves — a
SpacetimeDB server module and a Phaser browser client — sharing a pnpm
workspace and a single TypeScript toolchain.

## 1. Runtime

- **Language:** TypeScript throughout (server, client, content pipeline).
  No
  other language is anchored by clew in this repo.
- **Package manager:** pnpm workspaces (`pnpm-workspace.yaml`: `client`,
  `spacetimedb`; the root package is the workspace root itself, holding the
  content pipeline and shared tooling).
  No `packageManager` field or
  `.nvmrc`/engines range is currently pinned — deferred until a version
  mismatch actually bites; until then, whatever `pnpm`/Node the developer has
  installed is assumed compatible (validated at setup time: Node v24, pnpm
  v11).
- **Server runtime:** SpacetimeDB TypeScript server modules (`spacetimedb`
  package, currently pinned `2.6.*`/`2.7.*` across packages — see "Requires
  justification" below), bundled with esbuild
  (`spacetime:bundle` script → `spacetimedb/dist/bundle.js`) and published via
  the `clockworklabs/spacetime` Docker image (no local `spacetime` CLI
  install).
  Reducers are thin shells in `spacetimedb/src/index.ts`; game
  rules live in plain, SpacetimeDB-agnostic TS functions in
  `spacetimedb/src/rules/*.ts` (see `docs/spec/architecture.md`).
- **Client runtime:** Phaser 4 + Vite (`client/` package), TypeScript
  compiled by `tsc` ahead of `vite build`.
  Browser-only; no SSR.
- **Content pipeline:** plain Node/TypeScript scripts (`content/*.ts`)
  validating hand-authored JSON (`cards.json`, `equipment.json`) against Zod
  schemas before either the server or the site consume them.
- **Local dev database:** Docker-hosted, in-memory SpacetimeDB instance
  (`db:start`/`db:stop`/`db:restart` scripts) — all data is wiped on every
  restart; not a persistence guarantee of any kind.
- **Reference site:** Jekyll (Ruby), generated from `content/cards.json` —
  out of scope for this contract; it has no TypeScript to anchor.

## 2. Approved libraries

- **Server:** `spacetimedb` SDK, `zod` (content validation).
- **Client:** `phaser`, `spacetimedb` SDK (generated client bindings under
  `client/src/generated/`, regenerated via `spacetime:generate` — never
  hand-edited).
- **Testing:** `vitest` — the only test runner in this repo.
  No test
  framework substitution without justification (see below).
- **Build:** `esbuild` (server bundling), `vite` + `tsc` (client), Docker
  (SpacetimeDB CLI/runtime, avoids a host install).

## 2a. Deviation already made and justified

- `client/tsconfig.json`'s `erasableSyntaxOnly` and `noUnusedParameters` were
  removed. clew's generated traceables (`src/clew/traceables/clew/*.ts`) use
  real TypeScript `enum` declarations — the mechanism that makes a removed
  spec id fail to compile wherever it's still anchored — which
  `erasableSyntaxOnly` forbids outright; `verifies()`'s `ids` parameter is
  also intentionally unread at runtime (it exists purely for compile-time
  id-checking), which `noUnusedParameters` flagged.
  Both removed rather than
  worked around (e.g. excluding the generated folder, which `tsc` still
  type-checks when it's reachable via import anyway), since the whole point
  is that `tsc` actually sees these constructs. `spacetimedb/tsconfig.json`
  never had either flag, so only the client project needed this.

## 3. Requires justification

- Introducing a new dependency, framework, test runner, or build tool not
  listed above.
- Changing the `spacetimedb` SDK's major/minor version (client, server, and
  root currently carry slightly different pinned ranges — `2.6.0` in
  `client/package.json`, `2.6.*` in `spacetimedb/package.json`, `2.7.*` at
  the root; this drift is flagged here as a known inconsistency, not a
  deliberate policy — align them the next time any one of them is
  deliberately bumped).
- Adding a persistence layer other than SpacetimeDB's own tables, or a
  second database engine.
- Adding server-side logic that lives outside `spacetimedb/src/rules/*.ts`
  as a plain function (i.e. putting game rules directly in a reducer body,
  bypassing the thin-reducer convention — see `docs/spec/architecture.md`).
