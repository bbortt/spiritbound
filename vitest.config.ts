import { defineConfig } from 'vitest/config';

/**
 * Default unit-test config: fast, no external dependencies. Excludes the
 * integration suite (spacetimedb/integration/*.integration.test.ts), which
 * needs a live, published SpacetimeDB instance — see vitest.integration.config.ts.
 */
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
  },
});
