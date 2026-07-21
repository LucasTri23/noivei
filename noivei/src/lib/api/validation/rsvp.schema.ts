import { z } from 'zod'

// Token de RSVP é um UUID serializado como texto (guests.rsvp_token)
export const RsvpTokenSchema = z.string().trim().min(8).max(100)

// Aceita formatos brasileiros comuns: com/sem DDD, com/sem símbolos — (11) 99999-9999, 11999999999, +55 11 99999-9999
export const PhoneSchema = z
  .string()
  .trim()
  .min(8, 'Telefone inválido.')
  .max(20, 'Telefone inválido.')
  .regex(/^[\d\s()+-]+$/, 'Telefone inválido.')

// RSVP público só transita entre confirmado/recusado — "pendente" é o estado inicial.
// Telefone é exigido pra QUALQUER resposta (confirmar OU recusar) — não é uma
// verificação de identidade de verdade (qualquer um com o link ainda pode digitar
// qualquer telefone), mas cria fricção deliberada contra alguém mudando a resposta
// à toa se o link vazar/for reencaminhado sem querer.
export const UpdateRsvpSchema = z
  .object({
    status: z.enum(['confirmado', 'recusado']),
    phone:  PhoneSchema.nullable().optional(),
  })
  .refine(
    (value) => Boolean(value.phone && value.phone.trim().length > 0),
    { message: 'Informe seu telefone para responder.', path: ['phone'] },
  )

export type UpdateRsvpInput = z.infer<typeof UpdateRsvpSchema>
