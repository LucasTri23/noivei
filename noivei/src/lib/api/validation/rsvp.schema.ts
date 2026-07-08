import { z } from 'zod'

// Token de RSVP é um UUID serializado como texto (guests.rsvp_token)
export const RsvpTokenSchema = z.string().trim().min(8).max(100)

// RSVP público só transita entre confirmado/recusado — "pendente" é o estado inicial
export const UpdateRsvpSchema = z.object({
  status: z.enum(['confirmado', 'recusado']),
})

export type UpdateRsvpInput = z.infer<typeof UpdateRsvpSchema>
