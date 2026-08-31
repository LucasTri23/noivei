import { z } from 'zod'

// Sem CHECK constraint no banco (vendor_profiles.price_range é texto livre, ver
// migration 20260806000002) — o enum fica só na Zod, decisão de UI pra manter os
// dados consistentes ($ / $$ / $$$) sem travar o schema do banco a essa escolha.
export const VendorPriceRangeSchema = z.enum(['$', '$$', '$$$'])

// Campos que o PRÓPRIO fornecedor pode preencher/editar — status/featured/
// rejection_reason/deleted_at NUNCA aparecem aqui de propósito (ver comentário na
// migration 20260806000002 sobre a RLS de UPDATE permitir a linha inteira: a defesa
// real é este schema nunca aceitar esses campos, então a Route Handler nunca tem
// como repassá-los pro .insert()/.update()).
const VendorProfileFieldsSchema = z.object({
  business_name: z.string().trim().min(2, 'Informe o nome da empresa.').max(160),
  cnpj:          z.string().trim().max(20),
  phone:         z.string().trim().max(30),
  whatsapp:      z.string().trim().max(30),
  show_whatsapp: z.boolean(),
  instagram:     z.string().trim().max(100),
  website:       z.string().trim().max(255),
  city:          z.string().trim().max(120),
  state:         z.string().trim().max(60),
  description:   z.string().trim().max(2000),
  price_range:   VendorPriceRangeSchema,
})

export const CreateVendorProfileSchema = VendorProfileFieldsSchema.partial().required({
  business_name: true,
})
export type CreateVendorProfileInput = z.infer<typeof CreateVendorProfileSchema>

export const UpdateVendorProfileSchema = VendorProfileFieldsSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Informe ao menos um campo para atualizar.',
)
export type UpdateVendorProfileInput = z.infer<typeof UpdateVendorProfileSchema>

export const AddVendorCategorySchema = z.object({
  category_id: z.uuid(),
})
export type AddVendorCategoryInput = z.infer<typeof AddVendorCategorySchema>

export const CreateVendorPortfolioItemSchema = z.object({
  storage_path: z.string().trim().min(1, 'Caminho de armazenamento é obrigatório.').max(1024),
  caption:      z.string().trim().max(300).optional(),
  sort_order:   z.number().int().min(0).max(10_000).optional(),
})
export type CreateVendorPortfolioItemInput = z.infer<typeof CreateVendorPortfolioItemSchema>

// Reordenação/legenda de um item já existente — nunca aceita storage_path/vendor_id
// (imutáveis após o upload; trocar de arquivo é remover e subir de novo).
export const UpdateVendorPortfolioItemSchema = z
  .object({
    caption:    z.string().trim().max(300).nullable(),
    sort_order: z.number().int().min(0).max(10_000),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')
export type UpdateVendorPortfolioItemInput = z.infer<typeof UpdateVendorPortfolioItemSchema>
