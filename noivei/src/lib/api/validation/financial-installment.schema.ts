import { z } from 'zod'

// Valores monetários em centavos (mesmo padrão de financial.schema.ts). A ordem do
// array define installment_number (índice + 1) — a primeira linha costuma ser a entrada.
export const InstallmentPlanItemSchema = z.object({
  amount_cents: z.number().int().min(0),
  due_date:     z.iso.date(),
})

export const CreateInstallmentPlanSchema = z.object({
  installments: z.array(InstallmentPlanItemSchema).min(1).max(60),
})

export const UpdateInstallmentSchema = z.object({
  paid: z.boolean(),
})

export type InstallmentPlanItemInput  = z.infer<typeof InstallmentPlanItemSchema>
export type CreateInstallmentPlanInput = z.infer<typeof CreateInstallmentPlanSchema>
export type UpdateInstallmentInput    = z.infer<typeof UpdateInstallmentSchema>
