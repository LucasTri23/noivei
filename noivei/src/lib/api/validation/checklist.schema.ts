import { z } from 'zod'

export const CreateChecklistItemSchema = z.object({
  label:      z.string().trim().min(1, 'Label é obrigatório.').max(200),
  due_date:   z.iso.date().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
})

export const UpdateChecklistItemSchema = z
  .object({
    label:      z.string().trim().min(1).max(200),
    due_date:   z.iso.date().nullable(),
    completed:  z.boolean(),
    sort_order: z.number().int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export type CreateChecklistItemInput = z.infer<typeof CreateChecklistItemSchema>
export type UpdateChecklistItemInput = z.infer<typeof UpdateChecklistItemSchema>
