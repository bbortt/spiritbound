import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCards } from './validate';
import type { CardDef } from './validate';

export function loadCards(): CardDef[] {
  const dir = dirname(fileURLToPath(import.meta.url));
  const raw: unknown[] = JSON.parse(readFileSync(join(dir, 'cards.json'), 'utf-8'));
  return parseCards(raw);
}
