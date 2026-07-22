import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
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

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'financeiro')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'BUDGET_NOT_FOUND', 'Meta de gastos não encontrada.')
    }

    const { data, error } = await supabase
      .from('financial_category_budgets')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover meta de gastos.')
    if (!data) return err(404, 'BUDGET_NOT_FOUND', 'Meta de gastos não encontrada.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
