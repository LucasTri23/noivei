import { requireWeddingOwner } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwner(supabase, wid, user.id)

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')
    }

    // Convite já aceito/revogado não tem o que revogar — o filtro status='pending'
    // faz a linha não bater e cai no 404 abaixo, sem sobrescrever accepted_by/at.
    const { data, error } = await supabase
      .from('wedding_invites')
      .update({ status: 'revoked' })
      .eq('id', id)
      .eq('wedding_id', wid)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao revogar convite.')
    if (!data) return err(404, 'INVITE_NOT_FOUND', 'Convite não encontrado ou não está mais pendente.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
