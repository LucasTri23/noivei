import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpdatePlanFeatureSchema } from '@/lib/api/validation/admin-plan-features.schema'
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
    const parsed = UpdatePlanFeatureSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('plan_features')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar linha de comparação.')
    if (!data) return err(404, 'FEATURE_NOT_FOUND', 'Linha de comparação não encontrada.')

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
      .from('plan_features')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover linha de comparação.')
    if (!data) return err(404, 'FEATURE_NOT_FOUND', 'Linha de comparação não encontrada.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
