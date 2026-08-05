import { z } from 'zod'

// Valores monetários em centavos (mesmo padrão de weddings.budget)
export const CreateFinancialEntrySchema = z
  .object({
    category:         z.string().trim().min(1, 'Categoria é obrigatória.').max(80),
    vendor:           z.string().trim().min(1).max(120).nullable().optional(),
    description:      z.string().trim().max(500).nullable().optional(),
    total_amount:     z.number().int().min(0),
    paid_amount:      z.number().int().min(0).default(0),
    due_date:         z.iso.date().nullable().optional(),
    // id de um wedding_files já existente (ex.: orçamento/recibo anexado ao criar o
    // lançamento) — a rota confere que o arquivo pertence ao MESMO wedding_id antes de
    // gravar, nunca confia neste id vindo do client sozinho (ver POST .../financial).
    attached_file_id: z.uuid().nullable().optional(),
  })
  .refine((value) => value.paid_amount <= value.total_amount, {
    message: 'Valor pago não pode exceder o valor total.',
    path:    ['paid_amount'],
  })

export const UpdateFinancialEntrySchema = z
  .object({
    category:     z.string().trim().min(1).max(80),
    vendor:       z.string().trim().min(1).max(120).nullable(),
    description:  z.string().trim().max(500).nullable(),
    total_amount: z.number().int().min(0),
    paid_amount:  z.number().int().min(0),
    due_date:     z.iso.date().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export type CreateFinancialEntryInput = z.infer<typeof CreateFinancialEntrySchema>
export type UpdateFinancialEntryInput = z.infer<typeof UpdateFinancialEntrySchema>
