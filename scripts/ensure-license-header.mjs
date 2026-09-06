#!/usr/bin/env node
// Ensures every *.ts/*.tsx source file carries the CC BY-NC-SA 4.0 SPDX
// header.
//
// Two modes:
//   node scripts/ensure-license-header.mjs <files...>   (lint-staged, fixes)
//     Prepends the header to any of the given files that lack one. Run on
//     every commit (see lint-staged.config.mjs) so new source files pick up
//     the license automatically, without relying on contributors to
//     remember it.
//   node scripts/ensure-license-header.mjs --check       (CI, verifies)
//     Scans every git-tracked *.ts/*.tsx file and exits 1 if any lack the
//     header — the backstop for a commit made with `--no-verify` that skips
//     the hook above.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const HEADER =
  '// SPDX-License-Identifier: CC-BY-NC-SA-4.0\n' +
  '// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.\n' +
  '\n';

// Generated output — regenerated from source, and clew's own generated files
// carry their own "safe to edit" provenance header instead of a license one.
const GENERATED_PATH_SEGMENTS = [
  'src/clew/traceables/',
  'client/src/generated/',
];

function isGenerated(path) {
  const normalized = path.replace(/\\/g, '/');
  return GENERATED_PATH_SEGMENTS.some((seg) => normalized.includes(seg));
}

function fix(files) {
  let changed = 0;
  for (const path of files) {
    if (isGenerated(path)) continue;

    const content = readFileSync(path, 'utf-8');
    if (content.includes('SPDX-License-Identifier')) continue;

    const shebangMatch = content.match(/^#!.*\n/);
    const insertAt = shebangMatch ? shebangMatch[0].length : 0;
    const next = content.slice(0, insertAt) + HEADER + content.slice(insertAt);

    writeFileSync(path, next, 'utf-8');
    changed++;
    console.log(`ensure-license-header: added header to ${path}`);
  }
  if (changed > 0) {
    console.log(
      `ensure-license-header: ${changed} file(s) updated — re-staging.`,
    );
  }
}

function check() {
  const tracked = execFileSync('git', ['ls-files', '--', '*.ts', '*.tsx'], {
    encoding: 'utf-8',
  })
    .split('\n')
    .filter(Boolean)
    .filter((path) => !isGenerated(path));

  const missing = tracked.filter(
    (path) => !readFileSync(path, 'utf-8').includes('SPDX-License-Identifier'),
  );

  if (missing.length > 0) {
    console.error(
      `ensure-license-header: ${missing.length} file(s) missing the CC BY-NC-SA 4.0 SPDX header:`,
    );
    for (const path of missing) console.error(`  ${path}`);
    console.error(
      '\nRun `pnpm exec lint-staged` on a commit, or ' +
        '`node scripts/ensure-license-header.mjs <file>` directly, to fix.',
    );
    process.exit(1);
  }
  console.log(
    `ensure-license-header: all ${tracked.length} tracked TypeScript file(s) have the header.`,
  );
}

const args = process.argv.slice(2);
if (args[0] === '--check') {
  check();
} else {
  fix(args);
}
