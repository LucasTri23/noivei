import { z } from 'zod'

// Espelha admin-plan.schema.ts (casal), mas pro catálogo isolado vendor_plans —
// só 2 linhas hoje ('vendor_monthly'/'vendor_lifetime'), preço em centavos
// administrável sem deploy (Fase 5/7).
const SlugSchema = z.string().trim().regex(/^[a-z][a-z0-9_]{2,49}$/, 'Use apenas letras minúsculas, números e "_", começando com letra.')

export const CreateVendorPlanSchema = z.object({
  id:           SlugSchema,
  name:         z.string().trim().min(1).max(80),
  billing_type: z.enum(['monthly', 'lifetime']),
  price_cents:  z.number().int().min(0).max(100_000_00),
  active:       z.boolean().optional(),
  sort_order:   z.number().int().min(0).optional(),
})

export const UpdateVendorPlanSchema = z
  .object({
    name:        z.string().trim().min(1).max(80),
    price_cents: z.number().int().min(0).max(100_000_00),
    active:      z.boolean(),
    sort_order:  z.number().int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export type CreateVendorPlanInput = z.infer<typeof CreateVendorPlanSchema>
export type UpdateVendorPlanInput = z.infer<typeof UpdateVendorPlanSchema>
