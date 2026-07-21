import { z } from 'zod'

import type { FinancialQuoteType } from '@/types/database'

export const QUOTE_TYPES = ['local', 'buffet', 'fotografia', 'decoracao', 'musica', 'outro'] as const

// Rótulo legível por tipo — usado tanto na UI (agrupamento de orçamentos) quanto
// na rota de seleção (vira a `category` do lançamento criado em financial_entries).
export const QUOTE_TYPE_LABELS: Record<FinancialQuoteType, string> = {
  local:      'Espaço',
  buffet:     'Buffet',
  fotografia: 'Fotografia',
  decoracao:  'Decoração',
  musica:     'Música',
  outro:      'Outro',
}

// Valores monetários em centavos (mesmo padrão de financial.schema.ts)
export const CreateFinancialQuoteSchema = z.object({
  type:         z.enum(QUOTE_TYPES),
  vendor_name:  z.string().trim().min(1, 'Informe o nome do fornecedor/local.').max(160),
  amount_cents: z.number().int().min(0),
  notes:        z.string().trim().max(1000).nullable().optional(),
})

export const UpdateFinancialQuoteSchema = CreateFinancialQuoteSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export type CreateFinancialQuoteInput = z.infer<typeof CreateFinancialQuoteSchema>
export type UpdateFinancialQuoteInput = z.infer<typeof UpdateFinancialQuoteSchema>
