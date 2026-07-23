import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpsertPlanFeatureValueSchema } from '@/lib/api/validation/admin-plan-features.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

// Uma célula da matriz por vez (feature_id + group_key) — a UI salva ao sair do
// campo (blur), não em lote, pra não perder edições se o admin fechar a aba no meio.
export async function PUT(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const body = await parseJsonBody(req)
    const parsed = UpsertPlanFeatureValueSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('plan_feature_values')
      .upsert(parsed.data, { onConflict: 'feature_id,group_key' })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar valor da célula.')

    return ok(data)
  } catch (error) {
    return handleApiError(error)
  }
}
