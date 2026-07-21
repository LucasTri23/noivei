import { ok, err, handleApiError } from '@/lib/api/response'
import { AcceptInviteSchema } from '@/lib/api/validation/invite.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkMemberLimit } from '@/lib/billing/check-limit'
import { createSupabaseService } from '@/lib/supabase/service'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'

interface RouteContext {
  params: Promise<{ token: string }>
}

// Aceitar convite exige conta Noivei (o convite não cria conta, só dá acesso a um
// casamento existente) — requireAuth primeiro. wedding_invites/wedding_members não
// expõem INSERT/UPDATE pro client autenticado nesse fluxo (quem aceita ainda não é
// membro, então a RLS de wedding_members não o alcança), então usa service role —
// mesmo padrão do RSVP público, adaptado pra exigir sessão.
export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const { token } = await params

    const parsedToken = AcceptInviteSchema.safeParse({ token })
    if (!parsedToken.success) return err(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')

    const supabase = createSupabaseService()

    const { data: invite, error: inviteError } = await supabase
      .from('wedding_invites')
      .select('id, wedding_id, status, expires_at')
      .eq('token', parsedToken.data.token)
      .maybeSingle()

    if (inviteError) return err(500, 'DB_ERROR', 'Erro ao buscar o convite.')
    if (!invite) return err(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')

    if (invite.status === 'accepted') {
      return err(410, 'INVITE_ALREADY_USED', 'Este convite já foi usado.')
    }
    if (invite.status === 'revoked') {
      return err(410, 'INVITE_REVOKED', 'Este convite não é mais válido.')
    }
    if (new Date(invite.expires_at as string).getTime() < Date.now()) {
      return err(410, 'INVITE_EXPIRED', 'Este convite expirou.')
    }

    const weddingId = invite.wedding_id as string

    // Idempotência: quem já é membro (ex: clicou aceitar duas vezes) não deve ver um
    // erro de constraint UNIQUE cru — trata como sucesso sem checar limite de novo.
    const { data: existingMember } = await supabase
      .from('wedding_members')
      .select('id')
      .eq('wedding_id', weddingId)
      .eq('user_id', user.id)
      .maybeSingle()

    // Regra de produto: 1 casamento por conta, dono ou membro — sem essa checagem,
    // quem já participa de outro casamento poderia aceitar este convite e passar a
    // pertencer a dois ao mesmo tempo (wedding_members não tem nada que impeça isso
    // sozinha, a UNIQUE é só (wedding_id, user_id), não por usuário).
    if (!existingMember) {
      const currentWedding = await getUserWedding(supabase, user.id)
      if (currentWedding && currentWedding.id !== weddingId) {
        return err(
          409,
          'ALREADY_IN_ANOTHER_WEDDING',
          'Sua conta já faz parte de outro casamento. Não é possível participar de mais de um.',
        )
      }
    }

    if (!existingMember) {
      // Reconfere o limite: pode ter sido atingido entre o convite ser criado e aceito.
      const limitCheck = await checkMemberLimit(supabase, weddingId)
      if (!limitCheck.allowed) {
        return err(
          403,
          'MEMBER_LIMIT_REACHED',
          'O limite de usuários do plano deste casamento foi atingido.',
          { current: limitCheck.current, limit: limitCheck.limit },
        )
      }

      const { error: insertError } = await supabase
        .from('wedding_members')
        .insert({ wedding_id: weddingId, user_id: user.id, role: 'member' })

      if (insertError) return err(500, 'DB_ERROR', 'Erro ao aceitar o convite.')
    }

    const { error: updateError } = await supabase
      .from('wedding_invites')
      .update({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    if (updateError) return err(500, 'DB_ERROR', 'Erro ao aceitar o convite.')

    return ok({ wedding_id: weddingId })
  } catch (error) {
    return handleApiError(error)
  }
}
