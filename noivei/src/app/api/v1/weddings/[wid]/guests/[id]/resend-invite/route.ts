import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { Guest } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

// Gera um rsvp_token novo pro convidado — é o único jeito de reabrir a resposta de
// quem já respondeu (o link antigo trava pra sempre depois de usado, ver
// rsvp/[token]/route.ts). Reseta status pra 'pendente' e attending_count pra null:
// sem isso, o link novo cairia direto na trava de "já respondido" de novo, já que o
// status continuaria valendo do envio anterior.
//
// O mesmo rsvp_token também identifica o ingresso de check-in (/ingresso/[token],
// ver checkin/validate/route.ts) — reenviar o convite de RSVP invalida um ingresso
// já emitido pra esse convidado. Na prática isso não costuma colidir (ingresso só
// faz sentido depois de confirmado, reenvio de convite é do período de RSVP), mas
// vale saber que os dois comportamentos vivem no mesmo campo.
export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'convidados')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'GUEST_NOT_FOUND', 'Convidado não encontrado.')
    }

    const { data, error } = await supabase
      .from('guests')
      .update({
        rsvp_token:      crypto.randomUUID(),
        status:          'pendente',
        attending_count: null,
        invite_sent_at:  new Date().toISOString(),
      })
      .eq('id', id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao gerar novo link de convite.')
    if (!data) return err(404, 'GUEST_NOT_FOUND', 'Convidado não encontrado.')

    return ok(data as Guest)
  } catch (error) {
    return handleApiError(error)
  }
}
