// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { defineConfig } from 'vitest/config';

/**
 * Default unit-test config: fast, no external dependencies. Excludes the
 * integration suite (spacetimedb/integration/*.integration.test.ts), which
 * needs a live, published SpacetimeDB instance — see vitest.integration.config.ts.
 */
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      // lcov is what the Sonar step reads
      // (sonar.javascript.lcov.reportPaths); text-summary keeps the local run
      // readable without printing a table per file.
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
      // Report on every source file, not only the ones a test imported, so
      // deleting the last test for a module shows up as a coverage drop
      // instead of the file quietly leaving the report.
      all: true,
      include: [
        'client/src/**/*.ts',
        'content/**/*.ts',
        'spacetimedb/src/**/*.ts',
        'tools/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        // Code generated from the module schema and the clew corpus; owned by
        // its generator, not reviewable or testable here.
        'client/src/generated/**',
        'src/clew/traceables/**',
      ],
    },
    // Fails the run on any todo test — see vitest.noTodoTests.ts for why a
    // green todo is the dangerous state. includeTaskLocation is what lets it
    // report the offender as file:line instead of just the file.
    reporters: ['default', './vitest.noTodoTests.ts'],
    includeTaskLocation: true,
  },
});
