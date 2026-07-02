import { z } from 'zod'

export const GuestStatusSchema = z.enum(['confirmado', 'pendente', 'recusado'])

export const CreateGuestSchema = z.object({
  name:       z.string().trim().min(1, 'Nome é obrigatório.').max(120),
  group_name: z.string().trim().min(1).max(80).nullable().optional(),
  status:     GuestStatusSchema.optional(),
  email:      z.email('E-mail inválido.').nullable().optional(),
  phone:      z.string().trim().min(5).max(30).nullable().optional(),
})

export const UpdateGuestSchema = z
  .object({
    name:       z.string().trim().min(1).max(120),
    group_name: z.string().trim().min(1).max(80).nullable(),
    status:     GuestStatusSchema,
    email:      z.email('E-mail inválido.').nullable(),
    phone:      z.string().trim().min(5).max(30).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export const ListGuestsQuerySchema = z.object({
  status:     GuestStatusSchema.optional(),
  group_name: z.string().trim().min(1).optional(),
})

// Linha já parseada do CSV de import (nome,email,grupo)
export const ImportGuestRowSchema = z.object({
  name:       z.string().trim().min(1, 'Nome é obrigatório.').max(120),
  email:      z.email('E-mail inválido.').nullable(),
  group_name: z.string().trim().min(1).max(80).nullable(),
})

export type CreateGuestInput = z.infer<typeof CreateGuestSchema>
export type UpdateGuestInput = z.infer<typeof UpdateGuestSchema>
export type ImportGuestRow = z.infer<typeof ImportGuestRowSchema>
