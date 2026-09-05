**Title**
Content loaders are split from pure validators so SpacetimeDB can tree-shake node:fs

**Lens**: ARCH

**Status**: active

**Description**
The `node:fs`-touching `loadCards()`/`loadEquipment()` live in separate
files (`content/loader.ts`/`content/equipmentLoader.ts`) from the pure
`parseCards`/`parseEquipment`/Zod-schema code (`content/validate.ts`/
`content/validateEquipment.ts`); `spacetimedb/src/index.ts` imports only
the pure parse functions.

**Rationale**
SpacetimeDB's JS runtime has no `node:fs` — a single-file version that
mixed the loader and validator failed at publish time with `Could not
find module "node:fs"`. The split is load-bearing (it lets esbuild
tree-shake `node:fs` out of the server bundle entirely), not a stylistic
preference (`docs/ARCHITECTURE.md`'s "Gear stats wired into combat" ADR's
"Extended to equipment" addendum records this exact failure).

**Verification Description**
Reviewed by confirming `spacetimedb/src/index.ts` never imports
`loadCards`/`loadEquipment` (only `parseCards`/`parseEquipment`), and
that the `spacetime:bundle` script succeeds without a `node:fs`
resolution error.

## Relations

**Related**

- [STR-008](../stories/STR-008-content-validation.md)
