import { z } from 'zod'

// Slug seguro pra id/group_key: minúsculo, começa com letra, só letras/números/"_" —
// evita valor vazio, com espaço, maiúsculo ou caractere que quebre rota/URL.
const SlugSchema = z.string().trim().regex(/^[a-z][a-z0-9_]{2,49}$/, 'Use apenas letras minúsculas, números e "_", começando com letra.')

// Admin cria um plano novo no catálogo — group_key vazio/omitido = card próprio na
// tela de planos; group_key igual ao de outro plano existente = vira uma variante de
// cobrança (toggle) do mesmo card, ver src/lib/billing/plan-groups.ts.
export const CreatePlanSchema = z.object({
  id:            SlugSchema,
  name:          z.string().trim().min(1).max(80),
  description:   z.string().trim().max(500).nullable().optional(),
  price_brl:     z.number().int().min(0).max(100_000_00),
  group_key:     SlugSchema.nullable().optional(),
  billing_label: z.string().trim().max(40).nullable().optional(),
  billing_note:  z.string().trim().max(120).nullable().optional(),
  emoji:         z.string().trim().min(1).max(8).optional(),
  highlight:     z.boolean().optional(),
  sort_order:    z.number().int().min(0).optional(),
  is_active:     z.boolean().optional(),
})

export const UpdatePlanSchema = z
  .object({
    name:          z.string().trim().min(1).max(80),
    description:   z.string().trim().max(500).nullable(),
    price_brl:     z.number().int().min(0).max(100_000_00), // teto defensivo: R$ 100.000
    group_key:     SlugSchema.nullable(),
    billing_label: z.string().trim().max(40).nullable(),
    billing_note:  z.string().trim().max(120).nullable(),
    emoji:         z.string().trim().min(1).max(8),
    highlight:     z.boolean(),
    sort_order:    z.number().int().min(0),
    is_active:     z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

// Cria o primeiro (ou mais um) plan_limits pra um plano — necessário pro plano
// recém-criado (POST /api/v1/admin/plans) não nascer sem nenhum limite. `feature` só
// tem efeito prático se bater com uma das chaves que check-limit.ts de fato lê
// (max_guests, max_storage_mb, max_users, max_financial_entries,
// max_wedding_party_entries) — uma chave diferente fica só como dado inerte.
export const CreatePlanLimitSchema = z.object({
  plan_id: z.string().trim().min(1),
  feature: z.string().trim().min(1).max(60),
  value:   z.number().int().min(0).max(1_000_000),
})

// Admin edita só o `value` de um plan_limits JÁ EXISTENTE (par plano+feature).
export const UpdatePlanLimitSchema = z.object({
  value: z.number().int().min(0).max(1_000_000),
})

export type CreatePlanInput      = z.infer<typeof CreatePlanSchema>
export type UpdatePlanInput      = z.infer<typeof UpdatePlanSchema>
export type CreatePlanLimitInput = z.infer<typeof CreatePlanLimitSchema>
export type UpdatePlanLimitInput = z.infer<typeof UpdatePlanLimitSchema>
