import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreatePlanFeatureSchema } from '@/lib/api/validation/admin-plan-features.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const body = await parseJsonBody(req)
    const parsed = CreatePlanFeatureSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('plan_features')
      .insert(parsed.data)
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao criar linha de comparação.')

    return ok(data, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
