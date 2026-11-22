// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * A table that is declared but left out of `schema({...})` fails nowhere a
 * developer looks: the unit suite never imports the module (it needs
 * `spacetime:sys`), the esbuild bundle only has to resolve, and there is no
 * tsconfig covering `spacetimedb/`. The first symptom is `publish` dying in CI
 * with `Missing type name for RowBuilder`, because the reducer's scheduled-row
 * type was never registered. So check the source text instead.
 */
const SOURCE = readFileSync(
  fileURLToPath(new URL('./index.ts', import.meta.url)),
  'utf8',
);

function snakeToCamel(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

describe('schema registration', () => {
  it('registers every declared table', () => {
    const declared = [
      ...SOURCE.matchAll(/table\(\s*\{\s*name:\s*'([a-z0-9_]+)'/g),
    ].map((match) => snakeToCamel(match[1]!));
    expect(declared.length).toBeGreaterThan(0);

    const schemaBlock = /const db = schema\(\{([^}]*)\}\);/.exec(SOURCE)?.[1];
    const registered = new Set(
      (schemaBlock ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    );

    expect([...new Set(declared)].filter((t) => !registered.has(t))).toEqual(
      [],
    );
  });
});
