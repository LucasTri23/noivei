import { requireWeddingOwnerOrFullAccess } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

// Dono ou membro com full_access apenas — mesma restrição do connect (achado
// SEC-03): e-mail/nickname da conta MP conectada não deveria vazar pra qualquer
// membro com o módulo "presentes" liberado, só a quem realmente gerencia o
// recebimento. O componente cliente já trata erro 404 aqui como "não conectado".
export async function GET(_req: Request, { params }: { params: Promise<{ wid: string }> }) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnerOrFullAccess(supabase, wid, user.id)

    // wedding_mp_accounts não tem policy pra client comum — só devolve o essencial
    // pra UI (conectado ou não, e-mail/nickname pra reconhecer a conta), nunca os
    // tokens em si.
    const { data, error } = await createSupabaseService()
      .from('wedding_mp_accounts')
      .select('mp_email, mp_nickname, connected_at')
      .eq('wedding_id', wid)
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao consultar conexão com o Mercado Pago.')

    return ok({
      connected:    Boolean(data),
      email:        data?.mp_email ?? null,
      nickname:     data?.mp_nickname ?? null,
      connected_at: data?.connected_at ?? null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
