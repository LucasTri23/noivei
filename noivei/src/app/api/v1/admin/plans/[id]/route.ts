import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpdatePlanSchema } from '@/lib/api/validation/admin-plan.schema'
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
    const parsed = UpdatePlanSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('plans')
      .update(parsed.data)
      .eq('id', id)
      .select('id, name, description, price_brl, is_active, group_key, billing_label, billing_note, emoji, highlight, sort_order')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar plano.')
    if (!data) return err(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.')

    return ok(data)
  } catch (error) {
    return handleApiError(error)
  }
}

// Bloqueia a exclusão se alguém tem (ou já teve) uma assinatura desse plano — apagar
// a linha de `plans` quebraria o preço/nome exibido pra quem está nela. Cupons com
// applies_to_plan_id apontando pra este plano são removidos junto (ON DELETE CASCADE,
// definido na migration do painel admin) — isso é esperado, não uma checagem extra aqui.
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)
    const { id } = await params

    const { count, error: countError } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', id)

    if (countError) return err(500, 'DB_ERROR', 'Erro ao verificar assinaturas do plano.')
    if (count && count > 0) {
      return err(
        409,
        'PLAN_IN_USE',
        `Não é possível excluir: ${count} assinatura(s) já usaram esse plano. Desative-o em vez de excluir.`,
      )
    }

    const { data, error } = await supabase
      .from('plans')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao excluir plano.')
    if (!data) return err(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
