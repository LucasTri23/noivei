import { z } from 'zod'

import { CouponCodeSchema } from '@/lib/api/validation/admin-coupon.schema'

// Espelha admin-coupon.schema.ts (casal), mas pro catálogo isolado vendor_coupons —
// applies_to_plan_id aponta pra vendor_plans (nunca plans do casal), reforçando o
// isolamento já garantido no banco (20260806000003).
const CommonVendorCouponFields = {
  code:            CouponCodeSchema,
  max_redemptions: z.number().int().min(1).nullable().optional(),
  valid_from:      z.iso.datetime().nullable().optional(),
  valid_until:     z.iso.datetime().nullable().optional(),
  is_active:       z.boolean().optional(),
}

export const CreateVendorCouponSchema = z
  .discriminatedUnion('discount_type', [
    z.object({
      ...CommonVendorCouponFields,
      discount_type:      z.literal('percent'),
      discount_value:     z.number().int().min(1).max(100),
      applies_to_plan_id: z.string().trim().min(1).nullable().optional(),
    }),
    z.object({
      ...CommonVendorCouponFields,
      discount_type:      z.literal('fixed'),
      discount_value:     z.number().int().min(1),
      applies_to_plan_id: z.string().trim().min(1).nullable().optional(),
    }),
    z.object({
      ...CommonVendorCouponFields,
      discount_type:      z.literal('free_days'),
      applies_to_plan_id: z.string().trim().min(1, 'Informe o plano concedido.'),
      benefit_days:       z.number().int().min(1).max(3650),
    }),
  ])

export const UpdateVendorCouponSchema = z
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

export type CreateVendorCouponInput = z.infer<typeof CreateVendorCouponSchema>
export type UpdateVendorCouponInput = z.infer<typeof UpdateVendorCouponSchema>
