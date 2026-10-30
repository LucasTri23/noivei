import { z } from 'zod'
import { CreateVendorProfileSchema } from './vendor.schema'

// Transições que só o ADMIN pode disparar (a única que o próprio fornecedor pode
// fazer é draft/rejected -> pending_review, ver POST /api/v1/vendor/submit-for-review).
// Sempre valida a origem no servidor (ALLOWED_TRANSITIONS na Route Handler) — o
// client nunca decide sozinho se uma transição é válida.
export const VendorAdminActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'suspend', 'reactivate', 'pause']),
  reason: z.string().trim().max(1000).optional(),
})
export type VendorAdminActionInput = z.infer<typeof VendorAdminActionSchema>

export const VendorFeatureToggleSchema = z.object({
  featured: z.boolean(),
})
export type VendorFeatureToggleInput = z.infer<typeof VendorFeatureToggleSchema>

export const AdminCreateVendorSchema = CreateVendorProfileSchema.extend({
  email: z.string().trim().toLowerCase().email('Informe o e-mail do fornecedor.').max(255),
  category_ids: z.array(z.uuid()).min(1, 'Selecione ao menos uma categoria.').max(20)
    .refine((ids) => new Set(ids).size === ids.length, 'Não repita categorias.'),
})
