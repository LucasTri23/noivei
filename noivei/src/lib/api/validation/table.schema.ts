import { z } from 'zod'

export const CreateTableSchema = z.object({
  label:    z.string().trim().min(1, 'Nome da mesa é obrigatório.').max(80),
  capacity: z.number().int().min(1).max(100),
})

export const UpdateTableSchema = z
  .object({
    label:    z.string().trim().min(1).max(80),
    capacity: z.number().int().min(1).max(100),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export const AssignGuestSchema = z.object({
  guest_id: z.uuid('guest_id deve ser um UUID válido.'),
})

export type CreateTableInput = z.infer<typeof CreateTableSchema>
export type AssignGuestInput = z.infer<typeof AssignGuestSchema>
