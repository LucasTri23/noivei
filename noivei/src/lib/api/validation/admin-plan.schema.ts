import { z } from 'zod'

// Admin edita preço/nome/descrição/ativação de um plano JÁ EXISTENTE — não cria plano
// novo (o catálogo de PlanId é fixo no código, ver constants/plans.ts e
// plan-selector.tsx; um plano novo no banco não apareceria em lugar nenhum da UI).
export const UpdatePlanSchema = z
  .object({
    name:        z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).nullable(),
    price_brl:   z.number().int().min(0).max(100_000_00), // teto defensivo: R$ 100.000
    is_active:   z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

// Admin edita só o `value` de um plan_limits JÁ EXISTENTE (par plano+feature) — feature
// novo não teria efeito, porque check-limit.ts referencia chaves de feature fixas.
export const UpdatePlanLimitSchema = z.object({
  value: z.number().int().min(0).max(1_000_000),
})

export type UpdatePlanInput = z.infer<typeof UpdatePlanSchema>
export type UpdatePlanLimitInput = z.infer<typeof UpdatePlanLimitSchema>
