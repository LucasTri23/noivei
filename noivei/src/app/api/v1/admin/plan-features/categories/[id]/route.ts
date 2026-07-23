import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpdatePlanFeatureCategorySchema } from '@/lib/api/validation/admin-plan-features.schema'
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
    const parsed = UpdatePlanFeatureCategorySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('plan_feature_categories')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar categoria.')
    if (!data) return err(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.')

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
      .from('plan_feature_categories')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover categoria.')
    if (!data) return err(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
