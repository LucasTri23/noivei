import { z } from 'zod'

// Token de convite é um UUID serializado como texto (wedding_invites.token)
export const InviteTokenSchema = z.string().trim().min(1)

export const AcceptInviteSchema = z.object({ token: InviteTokenSchema })

export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>
