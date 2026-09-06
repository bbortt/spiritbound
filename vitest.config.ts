import { defineConfig } from 'vitest/config';

/**
 * Default unit-test config: fast, no external dependencies. Excludes the
 * integration suite (spacetimedb/integration/*.integration.test.ts), which
 * needs a live, published SpacetimeDB instance — see vitest.integration.config.ts.
 */
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
    // Fails the run on any todo test — see vitest.noTodoTests.ts for why a
    // green todo is the dangerous state. includeTaskLocation is what lets it
    // report the offender as file:line instead of just the file.
    reporters: ['default', './vitest.noTodoTests.ts'],
    includeTaskLocation: true,
  },
});
