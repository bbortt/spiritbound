#!/usr/bin/env node
// Ensures every *.ts/*.tsx source file carries the PolyForm Noncommercial
// 1.0.0 SPDX header. Source code is licensed separately from assets and
// content, which are CC BY-NC-SA 4.0 — see LICENSE-ASSETS.
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

const LICENSE_ID = 'PolyForm-Noncommercial-1.0.0';

// The id this repository used before the code/asset license split. Matched by
// exact line, and only in the header position: a looser match would rewrite a
// vendored file's own SPDX grant, or a bare mention of one inside a string.
const SUPERSEDED_LINE = '// SPDX-License-Identifier: CC-BY-NC-SA-4.0';

const HEADER =
  `// SPDX-License-Identifier: ${LICENSE_ID}\n` +
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
    if (content.includes(`SPDX-License-Identifier: ${LICENSE_ID}`)) continue;

    const shebangMatch = content.match(/^#!.*\n/);
    const insertAt = shebangMatch ? shebangMatch[0].length : 0;

    // End-of-line boundary: without it, a dual grant like "CC-BY-NC-SA-4.0 OR
    // MIT" prefix-matches and loses the other half.
    const endsLine = (at) =>
      at === content.length || content[at] === '\n' || content[at] === '\r';

    let next;
    let what;
    if (
      content.startsWith(SUPERSEDED_LINE, insertAt) &&
      endsLine(insertAt + SUPERSEDED_LINE.length)
    ) {
      // A presence-only check would let the pre-split id survive untouched.
      next =
        content.slice(0, insertAt) +
        `// SPDX-License-Identifier: ${LICENSE_ID}` +
        content.slice(insertAt + SUPERSEDED_LINE.length);
      what = 'corrected the header on';
    } else if (content.includes('SPDX-License-Identifier')) {
      // Someone else's grant, or a mention in a string. Not ours to rewrite;
      // --check reports it so a human decides.
      continue;
    } else {
      next = content.slice(0, insertAt) + HEADER + content.slice(insertAt);
      what = 'added header to';
    }

    writeFileSync(path, next, 'utf-8');
    changed++;
    console.log(`ensure-license-header: ${what} ${path}`);
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
    (path) =>
      !readFileSync(path, 'utf-8').includes(
        `SPDX-License-Identifier: ${LICENSE_ID}`,
      ),
  );

  if (missing.length > 0) {
    console.error(
      `ensure-license-header: ${missing.length} file(s) do not carry the ${LICENSE_ID} SPDX header (missing, or carrying a different id):`,
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
