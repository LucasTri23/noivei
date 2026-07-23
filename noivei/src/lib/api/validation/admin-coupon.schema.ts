import { z } from 'zod'

// Código digitável: sem espaço/acento pra evitar ambiguidade na hora de aplicar —
// normalizado em maiúsculas no schema pra "promo10" e "PROMO10" serem o mesmo código.
export const CouponCodeSchema = z
  .string()
  .trim()
  .min(3, 'Código muito curto.')
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, 'Use apenas letras, números, "-" e "_".')
  .transform((value) => value.toUpperCase())

// free_days não depende de discount_value (que fica null) — em vez disso exige
// applies_to_plan_id (qual plano conceder) e benefit_days (por quantos dias).
const CommonCouponFields = {
  code:               CouponCodeSchema,
  max_redemptions:    z.number().int().min(1).nullable().optional(),
  valid_from:         z.iso.datetime().nullable().optional(),
  valid_until:        z.iso.datetime().nullable().optional(),
  is_active:          z.boolean().optional(),
}

export const CreateCouponSchema = z
  .discriminatedUnion('discount_type', [
    z.object({
      ...CommonCouponFields,
      discount_type:      z.literal('percent'),
      discount_value:     z.number().int().min(1).max(100),
      applies_to_plan_id: z.string().trim().min(1).nullable().optional(),
    }),
    z.object({
      ...CommonCouponFields,
      discount_type:      z.literal('fixed'),
      discount_value:     z.number().int().min(1),
      applies_to_plan_id: z.string().trim().min(1).nullable().optional(),
    }),
    z.object({
      ...CommonCouponFields,
      discount_type:      z.literal('free_days'),
      applies_to_plan_id: z.string().trim().min(1, 'Informe o plano concedido.'),
      benefit_days:       z.number().int().min(1).max(3650),
    }),
  ])

export const UpdateCouponSchema = z
  .object({
    discount_type:      z.enum(['percent', 'fixed', 'free_days']),
    discount_value:     z.number().int().min(1).nullable(),
    applies_to_plan_id: z.string().trim().min(1).nullable(),
    benefit_days:       z.number().int().min(1).max(3650).nullable(),
    max_redemptions:    z.number().int().min(1).nullable(),
    valid_from:         z.iso.datetime().nullable(),
    valid_until:        z.iso.datetime().nullable(),
    is_active:          z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')
  .refine(
    (value) => value.discount_type !== 'percent' || (value.discount_value ?? 1) <= 100,
    { message: 'Desconto percentual não pode passar de 100.', path: ['discount_value'] },
  )
  .refine(
    (value) => value.discount_type !== 'free_days' || Boolean(value.applies_to_plan_id),
    { message: 'Cupom de dias grátis precisa de um plano.', path: ['applies_to_plan_id'] },
  )
  .refine(
    (value) => value.discount_type !== 'free_days' || Boolean(value.benefit_days),
    { message: 'Informe quantos dias o cupom concede.', path: ['benefit_days'] },
  )

export type CreateCouponInput = z.infer<typeof CreateCouponSchema>
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>
