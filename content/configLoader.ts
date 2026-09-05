import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseConfig } from './validateConfig';
import type { ServerConfig } from './validateConfig';
import { realizes, ArchTraceables } from '../src/clew/traceables/clew';

export const loadConfig = realizes(
  [
    ArchTraceables.ARCH_009_CONTENT_LOADERS_ARE_SPLIT_FROM_PURE_VALIDATORS_SO_SPACETIMEDB_CAN_TREE_SHAKE_NODE_FS,
    ArchTraceables.ARCH_010_CONFIG_JSON_IS_OPERATOR_TUNABLE_CARDS_AND_EQUIPMENT_JSON_ARE_CONTENT,
  ] as const,
  function loadConfig(): ServerConfig {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw: unknown = JSON.parse(
      readFileSync(join(dir, 'config.json'), 'utf-8'),
    );
    return parseConfig(raw);
  },
);
