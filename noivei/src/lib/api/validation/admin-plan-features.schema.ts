import { z } from 'zod'

export const CreatePlanFeatureCategorySchema = z.object({
  title:      z.string().trim().min(1).max(80),
  sort_order: z.number().int().min(0).optional(),
})

export const UpdatePlanFeatureCategorySchema = z
  .object({
    title:      z.string().trim().min(1).max(80),
    sort_order: z.number().int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export const CreatePlanFeatureSchema = z.object({
  category_id: z.uuid(),
  label:       z.string().trim().min(1).max(120),
  sort_order:  z.number().int().min(0).optional(),
})

export const UpdatePlanFeatureSchema = z
  .object({
    label:      z.string().trim().min(1).max(120),
    sort_order: z.number().int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export const UpsertPlanFeatureValueSchema = z.object({
  feature_id: z.uuid(),
  group_key:  z.enum(['free', 'premium', 'plus']),
  value:      z.string().trim().min(1).max(120),
})
