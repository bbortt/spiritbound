import { z } from 'zod';
import {
  realizes,
  concerns,
  ConTraceables,
  SysTraceables,
} from '../src/clew/traceables/clew';

export { loadCards } from './loader';

const RARITY = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
const TYPE = ['active', 'passive'] as const;
const PASSIVE_KIND = ['ward', 'triggered'] as const;
const SCHOOL = ['physical', 'magical'] as const;
const SHAPE = ['cone', 'line', 'arc', 'circle'] as const;

export const CardSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'must be lowercase-hyphenated (a-z, 0-9, -)'),
    name: z.string().min(1),
    rarity: z.enum(RARITY),
    type: z.enum(TYPE),
    passiveKind: z.enum(PASSIVE_KIND).optional(),
    school: z.enum(SCHOOL),
    shape: z.enum(SHAPE),
    basePower: z.number().positive(),
    cooldownSeconds: z.number().min(0),
    mpCost: z.number().int().min(0),
    minLevel: z.number().int().min(1).max(50),
    flavor: z.string().min(1),
  })
  .superRefine((card, ctx) => {
    if (card.type === 'passive' && card.passiveKind === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['passiveKind'],
        message: 'passiveKind is required for passive cards',
      });
    }
    if (card.type === 'active' && card.passiveKind !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['passiveKind'],
        message: 'passiveKind must not be set for active cards',
      });
    }
  });

export type CardDef = z.infer<typeof CardSchema>;

const crossCheck = realizes(
  [
    ConTraceables.CON_014_LEGENDARY_CARDS_NEED_MINLEVEL_THIRTY_FIVE_EPIC_CARDS_NEED_TWENTY,
    ConTraceables.CON_015_A_WARD_PASSIVE_CARD_MUST_HAVE_ZERO_MP_COST,
  ] as const,
  function crossCheck(cards: CardDef[]): string[] {
    const errors: string[] = [];

    const slugs = cards.map((c) => c.slug);
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    if (dupes.length > 0) {
      errors.push(`Duplicate slugs: ${[...new Set(dupes)].join(', ')}`);
    }

    for (const card of cards) {
      if (card.rarity === 'legendary' && card.minLevel < 35) {
        errors.push(
          `${card.slug}: legendary card must have minLevel >= 35 (got ${card.minLevel})`,
        );
      }
      if (card.rarity === 'epic' && card.minLevel < 20) {
        errors.push(
          `${card.slug}: epic card must have minLevel >= 20 (got ${card.minLevel})`,
        );
      }
      if (
        card.type === 'passive' &&
        card.passiveKind === 'ward' &&
        card.mpCost !== 0
      ) {
        errors.push(
          `${card.slug}: ward passive must have mpCost === 0 (got ${card.mpCost})`,
        );
      }
    }

    return errors;
  },
);

export const validateCards = concerns(
  SysTraceables.SYS_008_CONTENT_IS_AUTHORED_AS_JSON_VALIDATED_THEN_IDEMPOTENTLY_SEEDED,
  function validateCards(cards: unknown[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const valid: CardDef[] = [];

    for (const item of cards) {
      const result = CardSchema.safeParse(item);
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
  },
);

export function parseCards(raw: unknown[]): CardDef[] {
  const { valid, errors } = validateCards(raw);
  if (!valid) throw new Error(`Card data invalid:\n${errors.join('\n')}`);
  return raw.map((item) => CardSchema.parse(item));
}
