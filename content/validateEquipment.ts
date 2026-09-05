import { z } from 'zod';

export { loadEquipment } from './equipmentLoader';

const CATEGORY = ['equipment', 'consumable', 'material', 'quest'] as const;
const SLOT = [
  'head',
  'chest',
  'hands',
  'legs',
  'boots',
  'main_hand',
  'off_hand',
  'necklace',
  'ring',
  'earring',
] as const;
const RARITY = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
const ARMOR_WEIGHT = ['cloth', 'chain', 'plate'] as const;
const SCHOOL = ['physical', 'magical'] as const;
const SHAPE = ['cone', 'line', 'arc', 'circle'] as const;

// Additive stat modifiers an item can grant. Mirrors StatBlock (spacetimedb/src/types.ts)
// but every field is optional — a ring might only give +maxHp.
export const StatModifiersSchema = z.object({
  power: z.number().nonnegative().optional(),
  knowledge: z.number().nonnegative().optional(),
  health: z.number().nonnegative().optional(),
  will: z.number().nonnegative().optional(),
  agility: z.number().nonnegative().optional(),
  precision: z.number().nonnegative().optional(),
  maxHp: z.number().nonnegative().optional(),
  hpRegen: z.number().nonnegative().optional(),
  maxMp: z.number().nonnegative().optional(),
  mpRegen: z.number().nonnegative().optional(),
  moveSpeed: z.number().nonnegative().optional(),
  weaponDamage: z.number().nonnegative().optional(),
  physicalAttack: z.number().nonnegative().optional(),
  magicAttack: z.number().nonnegative().optional(),
  attackSpeed: z.number().nonnegative().optional(),
  castingSpeed: z.number().nonnegative().optional(),
  physicalCrit: z.number().nonnegative().optional(),
  magicCrit: z.number().nonnegative().optional(),
  accuracy: z.number().nonnegative().optional(),
  magicAccuracy: z.number().nonnegative().optional(),
  healingBoost: z.number().nonnegative().optional(),
  physicalDef: z.number().nonnegative().optional(),
  magicDef: z.number().nonnegative().optional(),
  evasion: z.number().nonnegative().optional(),
  parry: z.number().nonnegative().optional(),
  block: z.number().nonnegative().optional(),
  magicResist: z.number().nonnegative().optional(),
});

export type StatModifiers = z.infer<typeof StatModifiersSchema>;

export const ItemSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9_-]+$/, 'must be lowercase (a-z, 0-9, -, _)'),
    name: z.string().min(1),
    category: z.enum(CATEGORY),
    slot: z.enum(SLOT).nullable(),
    rarity: z.enum(RARITY),
    minLevel: z.number().int().nonnegative(),
    armorWeight: z.enum(ARMOR_WEIGHT).nullable(),
    weaponSchool: z.enum(SCHOOL).nullable(),
    geometryShape: z.enum(SHAPE).nullable(),
    geometryWidth: z.number().positive().nullable(),
    geometryRange: z.number().positive().nullable(),
    stats: StatModifiersSchema,
    flavor: z.string().min(1),
  })
  .superRefine((item, ctx) => {
    const isMainHand = item.slot === 'main_hand';

    if (isMainHand) {
      if (item.weaponSchool === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['weaponSchool'],
          message: 'weaponSchool is required for main_hand items',
        });
      }
      if (item.geometryShape === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['geometryShape'],
          message: 'geometryShape is required for main_hand items',
        });
      }
      if (item.geometryWidth === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['geometryWidth'],
          message: 'geometryWidth is required for main_hand items',
        });
      }
      if (item.geometryRange === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['geometryRange'],
          message: 'geometryRange is required for main_hand items',
        });
      }
    } else {
      if (item.weaponSchool !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['weaponSchool'],
          message: 'weaponSchool must be null unless slot is main_hand',
        });
      }
      if (
        item.geometryShape !== null ||
        item.geometryWidth !== null ||
        item.geometryRange !== null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['geometryShape'],
          message: 'geometry fields must be null unless slot is main_hand',
        });
      }
    }
  });

export type ItemDef = z.infer<typeof ItemSchema>;

// Cross-item + item-balancer rules that don't fit cleanly into per-field schema shape.
function crossCheck(items: ItemDef[]): string[] {
  const errors: string[] = [];

  const slugs = items.map((i) => i.slug);
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dupes.length > 0) {
    errors.push(`Duplicate slugs: ${[...new Set(dupes)].join(', ')}`);
  }

  for (const item of items) {
    // Weapons and focuses aren't cloth/chain/plate — armor weight only applies to armor slots.
    if (
      item.armorWeight !== null &&
      (item.slot === 'main_hand' || item.slot === 'off_hand')
    ) {
      errors.push(
        `${item.slug}: armorWeight must be null for ${item.slot} items (weapons/focuses aren't cloth/chain/plate)`,
      );
    }

    const statValues = Object.values(item.stats) as number[];
    const maxStat = statValues.length > 0 ? Math.max(...statValues) : 0;

    if (item.rarity === 'epic' && maxStat < 20) {
      errors.push(
        `${item.slug}: epic item must have at least one stat >= 20 (max found: ${maxStat})`,
      );
    }
    if (item.rarity === 'legendary' && maxStat < 40) {
      errors.push(
        `${item.slug}: legendary item must have at least one stat >= 40 (max found: ${maxStat})`,
      );
    }

    if (item.stats.moveSpeed !== undefined && item.stats.moveSpeed >= 0.5) {
      errors.push(
        `${item.slug}: moveSpeed is a multiplier and must be < 0.5 (got ${item.stats.moveSpeed})`,
      );
    }
    if (item.stats.evasion !== undefined && item.stats.evasion >= 0.2) {
      errors.push(
        `${item.slug}: evasion is capped at 0.20 per item (got ${item.stats.evasion})`,
      );
    }

    // Balance rule (item-balancer seam): wide area = lower damage. A main_hand weapon
    // may not have both a wide/forgiving shape (width > 1.0) AND high damage output.
    if (
      item.slot === 'main_hand' &&
      item.geometryWidth !== null &&
      item.geometryWidth > 1.0
    ) {
      const totalDamage =
        (item.stats.weaponDamage ?? 0) +
        (item.stats.physicalAttack ?? 0) +
        (item.stats.magicAttack ?? 0);
      if (totalDamage > 20) {
        errors.push(
          `weapon ${item.slug} has wide geometry (width > 1.0) but high damage — violates ` +
            `the power-vs-area balance rule. Reduce damage or narrow the shape.`,
        );
      }
    }
  }

  return errors;
}

export function validateEquipment(items: unknown[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const valid: ItemDef[] = [];

  for (const item of items) {
    const result = ItemSchema.safeParse(item);
    if (!result.success) {
      const slug =
        typeof (item as Record<string, unknown>)?.slug === 'string'
          ? ((item as Record<string, unknown>).slug as string)
          : '(unknown)';
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || 'root';
        errors.push(`${slug}: ${path}: ${issue.message}`);
      }
    } else {
      valid.push(result.data);
    }
  }

  errors.push(...crossCheck(valid));
  return { valid: errors.length === 0, errors };
}

export function parseEquipment(raw: unknown[]): ItemDef[] {
  const { valid, errors } = validateEquipment(raw);
  if (!valid) throw new Error(`Equipment data invalid:\n${errors.join('\n')}`);
  return raw.map((item) => ItemSchema.parse(item));
}
