import { z } from 'zod'

export const SiteSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Slug deve ter ao menos 3 caracteres.')
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug deve conter apenas letras minúsculas, números e hífens.')

export const UpdateSiteConfigSchema = z
  .object({
    slug:                 SiteSlugSchema,
    published:            z.boolean(),
    cover_photo_url:      z.url('URL inválida.').nullable(),
    cover_photo_position: z.number().int().min(0).max(100),
    content:              z.record(z.string(), z.unknown()),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export type UpdateSiteConfigInput = z.infer<typeof UpdateSiteConfigSchema>
