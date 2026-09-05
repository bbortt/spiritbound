import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCards } from './validate';
import type { CardDef } from './validate';
import { realizes, ArchTraceables } from '../src/clew/traceables/clew';

export const loadCards = realizes(
  ArchTraceables.ARCH_009_CONTENT_LOADERS_ARE_SPLIT_FROM_PURE_VALIDATORS_SO_SPACETIMEDB_CAN_TREE_SHAKE_NODE_FS,
  function loadCards(): CardDef[] {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw: unknown[] = JSON.parse(
      readFileSync(join(dir, 'cards.json'), 'utf-8'),
    );
    return parseCards(raw);
  },
);
