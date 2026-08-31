import { z } from 'zod'

const CategorySlugSchema = z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/, 'Use apenas letras minúsculas, números e "_", começando com letra.')

export const CreateVendorCategorySchema = z.object({
  slug:       CategorySlugSchema,
  label:      z.string().trim().min(1).max(80),
  icon:       z.string().trim().max(40).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  active:     z.boolean().optional(),
})

export const UpdateVendorCategorySchema = z
  .object({
    label:      z.string().trim().min(1).max(80),
    icon:       z.string().trim().max(40).nullable(),
    sort_order: z.number().int().min(0),
    active:     z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export type CreateVendorCategoryInput = z.infer<typeof CreateVendorCategorySchema>
export type UpdateVendorCategoryInput = z.infer<typeof UpdateVendorCategorySchema>
