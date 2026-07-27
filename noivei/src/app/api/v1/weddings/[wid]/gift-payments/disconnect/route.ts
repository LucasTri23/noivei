import { requireWeddingOwnerOrFullAccess } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

// Dono ou membro com full_access apenas — mesma restrição do connect (achado SEC-03).
export async function POST(_req: Request, { params }: { params: Promise<{ wid: string }> }) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnerOrFullAccess(supabase, wid, user.id)

    // wedding_mp_accounts não tem policy pra client comum (guarda token de acesso a
    // dinheiro de terceiro) — a checagem de dono acima já aconteceu, então a escrita
    // em si usa service role.
    const { error } = await createSupabaseService()
      .from('wedding_mp_accounts')
      .delete()
      .eq('wedding_id', wid)

    if (error) return err(500, 'DB_ERROR', 'Erro ao desconectar a conta.')

    return ok({ disconnected: true })
  } catch (error) {
    return handleApiError(error)
  }
}
