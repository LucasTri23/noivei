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

export const CreateCouponSchema = z
  .object({
    code:               CouponCodeSchema,
    discount_type:      z.enum(['percent', 'fixed']),
    discount_value:     z.number().int().min(1),
    applies_to_plan_id: z.string().trim().min(1).nullable().optional(),
    max_redemptions:    z.number().int().min(1).nullable().optional(),
    valid_from:         z.iso.datetime().nullable().optional(),
    valid_until:        z.iso.datetime().nullable().optional(),
    is_active:          z.boolean().optional(),
  })
  .refine(
    (value) => value.discount_type !== 'percent' || value.discount_value <= 100,
    { message: 'Desconto percentual não pode passar de 100.', path: ['discount_value'] },
  )

export const UpdateCouponSchema = z
  .object({
    discount_type:      z.enum(['percent', 'fixed']),
    discount_value:     z.number().int().min(1),
    applies_to_plan_id: z.string().trim().min(1).nullable(),
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

export type CreateCouponInput = z.infer<typeof CreateCouponSchema>
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>
