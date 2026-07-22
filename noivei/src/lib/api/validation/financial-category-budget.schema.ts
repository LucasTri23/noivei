import { z } from 'zod'

// Meta de gastos por categoria — upsert por categoria (o form sempre manda a
// categoria inteira, nunca um id), então um único schema cobre criar e editar.
export const UpsertFinancialCategoryBudgetSchema = z.object({
  category:     z.string().trim().min(1, 'Categoria é obrigatória.').max(80),
  budget_cents: z.number().int().min(0),
})

export type UpsertFinancialCategoryBudgetInput = z.infer<typeof UpsertFinancialCategoryBudgetSchema>
