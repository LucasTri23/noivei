import { z } from 'zod'

// 'link': loja externa (store_url). 'app_payment': presente simbólico/fictício —
// dinheiro cairia na conta do casal via pagamento dentro do app (ainda não
// implementado; ver comentário na migration 20260722000003).
export const GiftRegistryTypeSchema = z.enum(['link', 'app_payment'])

// image_storage_path/image_size_bytes só vêm preenchidos quando a foto foi enviada do
// dispositivo (upload direto pro bucket "wedding-gift-photos") — nesse caso a API
// recalcula image_url a partir do path em toda leitura (ver gifts/route.ts), então o
// image_url enviado junto aqui é só um valor de conveniência, nunca a fonte da verdade
// pra foto enviada. Quando a foto é um link externo colado, os dois ficam null/omitidos.
export const CreateGiftRegistryItemSchema = z.object({
  name:               z.string().trim().min(1, 'Nome é obrigatório.').max(160),
  description:        z.string().trim().max(2000).nullable().optional(),
  price_cents:        z.number().int().min(0).nullable().optional(),
  store_url:          z.url('URL inválida.').max(2048).nullable().optional(),
  image_url:          z.url('URL inválida.').max(2048).nullable().optional(),
  image_storage_path: z.string().trim().min(1).max(500).nullable().optional(),
  image_size_bytes:   z.number().int().min(0).nullable().optional(),
  gift_type:          GiftRegistryTypeSchema.optional(),
  sort_order:         z.number().int().min(0).optional(),
})

export const UpdateGiftRegistryItemSchema = z
  .object({
    name:               z.string().trim().min(1).max(160),
    description:        z.string().trim().max(2000).nullable(),
    price_cents:        z.number().int().min(0).nullable(),
    store_url:          z.url('URL inválida.').max(2048).nullable(),
    image_url:          z.url('URL inválida.').max(2048).nullable(),
    image_storage_path: z.string().trim().min(1).max(500).nullable(),
    image_size_bytes:   z.number().int().min(0).nullable(),
    gift_type:          GiftRegistryTypeSchema,
    is_purchased:       z.boolean(),
    purchased_by:       z.string().trim().min(1).max(120).nullable(),
    sort_order:         z.number().int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export type CreateGiftRegistryItemInput = z.infer<typeof CreateGiftRegistryItemSchema>
export type UpdateGiftRegistryItemInput = z.infer<typeof UpdateGiftRegistryItemSchema>
