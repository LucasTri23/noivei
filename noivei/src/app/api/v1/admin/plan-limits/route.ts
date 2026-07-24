import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreatePlanLimitSchema } from '@/lib/api/validation/admin-plan.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

// Um plano recém-criado (ver POST /api/v1/admin/plans) nasce sem nenhum plan_limits —
// esta rota cria o primeiro (ou mais um) limite pra ele; PATCH/DELETE em
// plan-limits/[id] seguem cuidando de editar/remover os que já existem.
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const body = await parseJsonBody(req)
    const parsed = CreatePlanLimitSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('plan_limits')
      .insert(parsed.data)
      .select('id, plan_id, feature, value')
      .single()

    if (error) {
      if (error.code === '23505') return err(409, 'PLAN_LIMIT_TAKEN', 'Esse plano já tem um limite com essa feature.')
      return err(500, 'DB_ERROR', 'Erro ao criar limite.')
    }

    return ok(data, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
