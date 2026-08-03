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

// group_key deixou de ser um enum fixo — o catálogo de planos é dinâmico agora
// (ver plans.group_key), então qualquer slug que exista entre os planos é válido.
export const UpsertPlanFeatureValueSchema = z.object({
  feature_id: z.uuid(),
  group_key:  z.string().trim().min(1).max(50),
  value:      z.string().trim().min(1).max(120),
})

// Mesma lista fixa do CHECK de plan_module_access (migration 20260729000001) — os
// módulos do casamento são um conjunto fechado, ao contrário de group_key acima.
export const WeddingModuleKeySchema = z.enum([
  'checklist', 'convidados', 'financeiro', 'mesas',
  'site', 'arquivos', 'presentes', 'padrinhos', 'checkin', 'album',
])

export const UpsertPlanModuleAccessSchema = z.object({
  plan_id: z.string().trim().min(1).max(80),
  module:  WeddingModuleKeySchema,
  enabled: z.boolean(),
})
