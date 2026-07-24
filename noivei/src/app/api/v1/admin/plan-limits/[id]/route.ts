import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpdatePlanLimitSchema } from '@/lib/api/validation/admin-plan.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)
    const { id } = await params

    const body = await parseJsonBody(req)
    const parsed = UpdatePlanLimitSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('plan_limits')
      .update(parsed.data)
      .eq('id', id)
      .select('id, plan_id, feature, value')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar limite.')
    if (!data) return err(404, 'PLAN_LIMIT_NOT_FOUND', 'Limite não encontrado.')

    return ok(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)
    const { id } = await params

    const { data, error } = await supabase
      .from('plan_limits')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover limite.')
    if (!data) return err(404, 'PLAN_LIMIT_NOT_FOUND', 'Limite não encontrado.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
