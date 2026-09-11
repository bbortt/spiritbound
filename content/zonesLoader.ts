// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseZones } from './validateZones';
import type { ZoneDef } from './validateZones';
import { realizes, ArchTraceables } from '../src/clew/traceables/clew';

export const loadZones = realizes(
  ArchTraceables.ARCH_009_CONTENT_LOADERS_ARE_SPLIT_FROM_PURE_VALIDATORS_SO_SPACETIMEDB_CAN_TREE_SHAKE_NODE_FS,
  function loadZones(): ZoneDef[] {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw: unknown[] = JSON.parse(
      readFileSync(join(dir, 'zones.json'), 'utf-8'),
    );
    return parseZones(raw);
  },
);
