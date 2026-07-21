import { ok, err, handleApiError } from '@/lib/api/response'
import { AcceptInviteSchema } from '@/lib/api/validation/invite.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkMemberLimit } from '@/lib/billing/check-limit'
import { createSupabaseService } from '@/lib/supabase/service'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'

interface RouteContext {
  params: Promise<{ token: string }>
}

// Aceitar convite exige conta Wednest (o convite não cria conta, só dá acesso a um
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
      .select('id, wedding_id, status, expires_at, accepted_by')
      .eq('token', parsedToken.data.token)
      .maybeSingle()

    if (inviteError) return err(500, 'DB_ERROR', 'Erro ao buscar o convite.')
    if (!invite) return err(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')

    const weddingId = invite.wedding_id as string

    // Checa ANTES de olhar invite.status: se quem está pedindo agora já é membro
    // deste casamento (ex.: clique duplo, reabriu a página depois de aceitar com
    // sucesso), é o próprio sucesso anterior dele — trata como sucesso idempotente,
    // não como "convite já usado por outra pessoa". Sem essa ordem, um clique duplo
    // fazia a segunda requisição (que ainda venceu a corrida antes do primeiro
    // `update` de status) ler `status === 'accepted'` e devolver erro pro usuário
    // que, na verdade, tinha acabado de entrar com sucesso.
    const { data: existingMember } = await supabase
      .from('wedding_members')
      .select('id')
      .eq('wedding_id', weddingId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingMember) {
      return ok({ wedding_id: weddingId })
    }

    // A partir daqui, quem pede não é membro ainda — as checagens de status valem
    // pra bloquear de verdade (convite usado por OUTRA pessoa, revogado, expirado).
    if (invite.status === 'accepted') {
      return err(410, 'INVITE_ALREADY_USED', 'Este convite já foi usado.')
    }
    if (invite.status === 'revoked') {
      return err(410, 'INVITE_REVOKED', 'Este convite não é mais válido.')
    }
    if (new Date(invite.expires_at as string).getTime() < Date.now()) {
      return err(410, 'INVITE_EXPIRED', 'Este convite expirou.')
    }

    // Regra de produto: 1 casamento por conta, dono ou membro — sem essa checagem,
    // quem já participa de outro casamento poderia aceitar este convite e passar a
    // pertencer a dois ao mesmo tempo (wedding_members não tem nada que impeça isso
    // sozinha, a UNIQUE é só (wedding_id, user_id), não por usuário).
    const currentWedding = await getUserWedding(supabase, user.id)
    if (currentWedding && currentWedding.id !== weddingId) {
      return err(
        409,
        'ALREADY_IN_ANOTHER_WEDDING',
        'Sua conta já faz parte de outro casamento. Não é possível participar de mais de um.',
      )
    }

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

    // Corrida rara: duas requisições concorrentes do mesmo usuário passaram pelo
    // check de existingMember antes de qualquer uma inserir — a UNIQUE(wedding_id,
    // user_id) rejeita a segunda com "23505". Não é um erro de verdade pro usuário
    // (ele já está dentro, foi só a outra requisição que ganhou a corrida).
    if (insertError && insertError.code !== '23505') {
      return err(500, 'DB_ERROR', 'Erro ao aceitar o convite.')
    }

    // Só a requisição que realmente inseriu marca o convite como aceito — a que
    // perdeu a corrida do insert (23505) não sobrescreve accepted_by/accepted_at.
    if (!insertError) {
      const { error: updateError } = await supabase
        .from('wedding_invites')
        .update({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString() })
        .eq('id', invite.id)

      if (updateError) return err(500, 'DB_ERROR', 'Erro ao aceitar o convite.')
    }

    return ok({ wedding_id: weddingId })
  } catch (error) {
    return handleApiError(error)
  }
}
