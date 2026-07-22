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

// Acompanhante informado no RSVP quando attending_count > 1 — vira um convidado de
// verdade (ver PATCH /api/v1/rsvp/[token]), não só um número solto.
export const RsvpCompanionSchema = z.object({
  name:  z.string().trim().min(1, 'Nome é obrigatório.').max(120),
  phone: PhoneSchema,
})

// RSVP público só transita entre confirmado/recusado — "pendente" é o estado inicial.
// Telefone é exigido pra QUALQUER resposta (confirmar OU recusar) — não é uma
// verificação de identidade de verdade (qualquer um com o link ainda pode digitar
// qualquer telefone), mas cria fricção deliberada contra alguém mudando a resposta
// à toa se o link vazar/for reencaminhado sem querer.
//
// attending_count/companions só valem pra "confirmado" — quantas pessoas do convite
// (party_size, definido pelo casal) de fato vão comparecer. A conferência de que
// attending_count <= party_size do convidado é feita na rota (depende do banco, não
// dá pra validar só com o schema); aqui só garantimos consistência interna do body:
// a quantidade de acompanhantes enviada bate com attending_count - 1.
export const UpdateRsvpSchema = z
  .object({
    status:          z.enum(['confirmado', 'recusado']),
    phone:           PhoneSchema.nullable().optional(),
    attending_count: z.number().int().min(1).max(20).optional(),
    companions:      z.array(RsvpCompanionSchema).max(19).optional(),
  })
  .refine(
    (value) => Boolean(value.phone && value.phone.trim().length > 0),
    { message: 'Informe seu telefone para responder.', path: ['phone'] },
  )
  .refine(
    (value) => {
      if (value.status !== 'confirmado') return true
      const expectedCompanions = Math.max(0, (value.attending_count ?? 1) - 1)
      return (value.companions?.length ?? 0) === expectedCompanions
    },
    { message: 'A quantidade de acompanhantes não bate com o número de pessoas informado.', path: ['companions'] },
  )

export type UpdateRsvpInput = z.infer<typeof UpdateRsvpSchema>
export type RsvpCompanionInput = z.infer<typeof RsvpCompanionSchema>
