import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpsertFinancialCategoryBudgetSchema } from '@/lib/api/validation/financial-category-budget.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { isPaidPlan } from '@/constants/plans'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { FinancialCategoryBudget } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'financeiro')

    const { data, error } = await supabase
      .from('financial_category_budgets')
      .select('*')
      .eq('wedding_id', wid)

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar metas de gastos por categoria.')

    return ok((data ?? []) as FinancialCategoryBudget[])
  } catch (error) {
    return handleApiError(error)
  }
}

// Upsert por categoria: o formulário sempre manda a categoria inteira (não um id) —
// mais simples que expor um PATCH/[id] pro client ter que primeiro descobrir se já
// existe uma meta pra aquela categoria.
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'financeiro')

    // Reforço server-side: a aba "Orçamentos" já é escondida no client pro Gratuito,
    // mas isso é só UX — sem essa checagem aqui, uma chamada direta à API contornaria
    // o gate de plano.
    const planId = await resolveWeddingPlanId(supabase, wid)
    if (!isPaidPlan(planId)) {
      return err(403, 'PREMIUM_REQUIRED', 'Meta de gastos por categoria é um recurso do plano Premium.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpsertFinancialCategoryBudgetSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('financial_category_budgets')
      .upsert({ ...parsed.data, wedding_id: wid }, { onConflict: 'wedding_id,category' })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao salvar meta de gastos.')

    return ok(data as FinancialCategoryBudget, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
