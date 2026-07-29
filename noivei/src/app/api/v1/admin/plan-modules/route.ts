import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpsertPlanModuleAccessSchema } from '@/lib/api/validation/admin-plan-features.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

// Uma célula da matriz (plano × módulo) por vez — a UI salva ao marcar/desmarcar o
// checkbox, mesmo padrão de plan-features/values (edição em massa gera várias
// chamadas legítimas, por isso o teto mais alto que o resto das rotas de admin).
export async function PUT(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `admin-plan-module-write:${user.id}`, 150, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const body = await parseJsonBody(req)
    const parsed = UpsertPlanModuleAccessSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('plan_module_access')
      .upsert(parsed.data, { onConflict: 'plan_id,module' })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar acesso ao módulo.')

    return ok(data)
  } catch (error) {
    return handleApiError(error)
  }
}
