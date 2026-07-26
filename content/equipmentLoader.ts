import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseEquipment } from './validateEquipment';
import type { ItemDef } from './validateEquipment';

export function loadEquipment(): ItemDef[] {
  const dir = dirname(fileURLToPath(import.meta.url));
  const raw: unknown[] = JSON.parse(readFileSync(join(dir, 'equipment.json'), 'utf-8'));
  return parseEquipment(raw);
}
