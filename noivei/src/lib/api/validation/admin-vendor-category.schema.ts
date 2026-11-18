import { z } from 'zod'

const CategorySlugSchema = z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/, 'Use apenas letras minúsculas, números e "_", começando com letra.')
const DescriptionSchema  = z.string().trim().max(500).transform((value) => value || null).nullable()

// parent_id ausente/null = categoria principal; preenchido = subcategoria.
// Slug é imutável depois de criado (não está no schema de update) — URLs de
// filtro e o checklist dependem dele.
export const CreateVendorCategorySchema = z.object({
  slug:        CategorySlugSchema,
  label:       z.string().trim().min(1).max(80),
  description: DescriptionSchema.optional(),
  parent_id:   z.uuid().nullable().optional(),
  icon:        z.string().trim().max(40).nullable().optional(),
  sort_order:  z.number().int().min(0).optional(),
  active:      z.boolean().optional(),
})

export const UpdateVendorCategorySchema = z
  .object({
    label:       z.string().trim().min(1).max(80),
    description: DescriptionSchema,
    parent_id:   z.uuid().nullable(),
    icon:        z.string().trim().max(40).nullable(),
    sort_order:  z.number().int().min(0),
    active:      z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export const ReorderVendorCategoriesSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200).refine((ids) => new Set(ids).size === ids.length, 'IDs repetidos.'),
})

export type CreateVendorCategoryInput   = z.infer<typeof CreateVendorCategorySchema>
export type UpdateVendorCategoryInput   = z.infer<typeof UpdateVendorCategorySchema>
export type ReorderVendorCategoriesInput = z.infer<typeof ReorderVendorCategoriesSchema>
