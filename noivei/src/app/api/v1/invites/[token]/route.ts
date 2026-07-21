import { ok, err, handleApiError } from '@/lib/api/response'
import { InviteTokenSchema } from '@/lib/api/validation/invite.schema'
import { getInviteByToken } from '@/lib/invites/get-invite-by-token'
import { createSupabaseService } from '@/lib/supabase/service'

// Rota pública (sem auth): quem está checando um convite ainda não é membro do
// casamento. Usa service role porque a RLS de wedding_invites só cobre o dono.

interface RouteContext {
  params: Promise<{ token: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { token } = await params

    const parsedToken = InviteTokenSchema.safeParse(token)
    if (!parsedToken.success) {
      return err(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')
    }

    const supabase = createSupabaseService()
    const invite = await getInviteByToken(supabase, parsedToken.data)

    if (!invite) return err(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')

    return ok(invite)
  } catch (error) {
    return handleApiError(error)
  }
}
