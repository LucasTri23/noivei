import { z } from 'zod'

// Token de convite é um UUID serializado como texto (wedding_invites.token)
export const InviteTokenSchema = z.string().trim().min(1)

export const AcceptInviteSchema = z.object({ token: InviteTokenSchema })

// Body opcional do accept — só é enviado na segunda tentativa, depois que o usuário
// confirma que quer sair do casamento atual (ver ALREADY_IN_ANOTHER_WEDDING).
export const AcceptInviteBodySchema = z
  .object({ confirm_leave_current_wedding: z.boolean() })
  .partial()

export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>
export type AcceptInviteBodyInput = z.infer<typeof AcceptInviteBodySchema>
