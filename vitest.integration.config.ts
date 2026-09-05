import { defineConfig } from 'vitest/config';

/**
 * Integration-test config: real HTTP calls against a live, published
 * SpacetimeDB instance (spacetimedb/integration/*.integration.test.ts — see
 * that directory's client.ts/helpers.ts). Excluded from the default `vitest
 * run` (vitest.config.ts) since it needs `pnpm run db:start` +
 * `pnpm run spacetime:publish:local` first, and is slower (real network
 * round-trips, some tests farm probabilistic drops).
 */
export default defineConfig({
  test: {
    include: ['spacetimedb/integration/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // These tests share one live server's state; running files in parallel
    // is safe (each test uses its own identity and a unique world position),
    // but keep it single-threaded to stay easy to reason about and avoid
    // hammering the dev instance with concurrent drop-farming loops.
    fileParallelism: false,
  },
});
