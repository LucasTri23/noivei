import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateFinancialQuoteSchema } from '@/lib/api/validation/financial-quote.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { isPaidPlan } from '@/constants/plans'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { FinancialQuote } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'QUOTE_NOT_FOUND', 'Orçamento não encontrado.')
    }

    const planId = await resolveWeddingPlanId(supabase, wid)
    if (!isPaidPlan(planId)) {
      return err(403, 'PREMIUM_REQUIRED', 'Orçamentos por categoria é um recurso do plano Premium.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateFinancialQuoteSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('financial_quotes')
      .update(parsed.data)
      .eq('id', id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar orçamento.')
    if (!data) return err(404, 'QUOTE_NOT_FOUND', 'Orçamento não encontrado.')

    return ok(data as FinancialQuote)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'QUOTE_NOT_FOUND', 'Orçamento não encontrado.')
    }

    const { data: existing, error: fetchError } = await supabase
      .from('financial_quotes')
      .select('financial_entry_id')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao buscar orçamento.')
    if (!existing) return err(404, 'QUOTE_NOT_FOUND', 'Orçamento não encontrado.')

    const { data, error } = await supabase
      .from('financial_quotes')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover orçamento.')
    if (!data) return err(404, 'QUOTE_NOT_FOUND', 'Orçamento não encontrado.')

    // Um orçamento selecionado tem um lançamento real associado (financial_entry_id).
    // Apagar o orçamento e deixar esse lançamento pra trás criaria um gasto "fantasma"
    // no Financeiro sem origem — por isso o lançamento correspondente também é removido.
    const entryId = (existing as { financial_entry_id: string | null }).financial_entry_id
    if (entryId) {
      await supabase.from('financial_entries').delete().eq('id', entryId).eq('wedding_id', wid)
    }

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
