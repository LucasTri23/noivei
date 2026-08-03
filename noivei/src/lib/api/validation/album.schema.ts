import { z } from 'zod'

// Token do mural é um UUID de verdade (weddings.album_token), diferente do token
// de RSVP (guests.rsvp_token, TEXT) — validado como UUID antes de qualquer query.
export const AlbumTokenSchema = z.uuid()

// Mesmo formato frouxo de telefone do RSVP público (PhoneSchema em rsvp.schema.ts)
// — aceita formatos brasileiros comuns, sem validar internacionalização.
const AlbumPhoneSchema = z
  .string()
  .trim()
  .min(8, 'Telefone inválido.')
  .max(20, 'Telefone inválido.')
  .regex(/^[\d\s()+-]+$/, 'Telefone inválido.')

export const RegisterContributorSchema = z.object({
  name:         z.string().trim().min(1, 'Nome é obrigatório.').max(120),
  relationship: z.string().trim().min(1, 'Informe sua relação com o casal.').max(120),
  phone:        AlbumPhoneSchema,
})

export type RegisterContributorInput = z.infer<typeof RegisterContributorSchema>
