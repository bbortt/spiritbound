// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
// `?raw` rather than node:fs: this package is browser-only and has no node
// types, and vite's own declaration covers the import.
import POEM from '../../docs/PROLOGUE.md?raw';
import { PROLOGUE_BEATS } from './prologueBeats';
import { verifies, ArchTraceables } from '../../src/clew/traceables/clew';

verifies(
  ArchTraceables.ARCH_014_THE_VERSE_LIVES_IN_THE_DOCUMENT_AND_THE_MANIFEST_IS_TESTED_AGAINST_IT,
  () => {
    describe('the beat manifest does not drift from the poem', () => {
      it('reads a non-empty document', () => {
        // Without this the line assertions below would pass vacuously against
        // an empty haystack if the file were ever moved or renamed.
        expect(POEM.length).toBeGreaterThan(1000);
      });

      it.each(
        PROLOGUE_BEATS.flatMap((beat, i) =>
          beat.lines.map((line) => ({
            i,
            plate: beat.plate ?? 'black card',
            line,
          })),
        ),
      )('beat $i ($plate): $line', ({ line }) => {
        expect(POEM).toContain(line);
      });
    });
  },
);
