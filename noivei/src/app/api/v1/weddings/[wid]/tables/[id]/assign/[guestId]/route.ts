import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ wid: string; id: string; guestId: string }>
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id, guestId } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'mesas')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')
    }
    if (!UuidSchema.safeParse(guestId).success) {
      return err(404, 'ASSIGNMENT_NOT_FOUND', 'Alocação não encontrada.')
    }

    const { data: table, error: tableError } = await supabase
      .from('tables_config')
      .select('id')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (tableError) return err(500, 'DB_ERROR', 'Erro ao buscar mesa.')
    if (!table) return err(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')

    const { data, error } = await supabase
      .from('table_assignments')
      .delete()
      .eq('table_id', id)
      .eq('guest_id', guestId)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover alocação.')
    if (!data) return err(404, 'ASSIGNMENT_NOT_FOUND', 'Alocação não encontrada.')

    return ok({ table_id: id, guest_id: guestId })
  } catch (error) {
    return handleApiError(error)
  }
}
