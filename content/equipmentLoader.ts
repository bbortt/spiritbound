import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseEquipment } from './validateEquipment';
import type { ItemDef } from './validateEquipment';
import { realizes, ArchTraceables } from '../src/clew/traceables/clew';

export const loadEquipment = realizes(
  ArchTraceables.ARCH_009_CONTENT_LOADERS_ARE_SPLIT_FROM_PURE_VALIDATORS_SO_SPACETIMEDB_CAN_TREE_SHAKE_NODE_FS,
  function loadEquipment(): ItemDef[] {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw: unknown[] = JSON.parse(
      readFileSync(join(dir, 'equipment.json'), 'utf-8'),
    );
    return parseEquipment(raw);
  },
);
