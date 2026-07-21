import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { QUOTE_TYPE_LABELS } from '@/lib/api/validation/financial-quote.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { isPaidPlan } from '@/constants/plans'
import { CHECKLIST_CATALOG_KEY_BY_TYPE } from '@/lib/financial/checklist-catalog'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { FinancialEntry, FinancialQuote } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

export async function POST(_req: Request, { params }: RouteContext) {
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

    // 1. Busca o orçamento a selecionar
    const { data: quoteRow, error: quoteError } = await supabase
      .from('financial_quotes')
      .select('*')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (quoteError) return err(500, 'DB_ERROR', 'Erro ao buscar orçamento.')
    if (!quoteRow) return err(404, 'QUOTE_NOT_FOUND', 'Orçamento não encontrado.')

    const quote = quoteRow as FinancialQuote

    // 2. Se já existe outro orçamento do mesmo tipo selecionado, desfaz essa seleção
    // e remove o lançamento antigo primeiro — do contrário o mesmo tipo de gasto
    // (ex.: "Espaço") ficaria contado duas vezes no Financeiro até a troca terminar.
    const { data: previousRows, error: previousError } = await supabase
      .from('financial_quotes')
      .select('id, financial_entry_id')
      .eq('wedding_id', wid)
      .eq('type', quote.type)
      .eq('is_selected', true)
      .neq('id', quote.id)

    if (previousError) return err(500, 'DB_ERROR', 'Erro ao buscar orçamento selecionado anteriormente.')

    for (const previous of (previousRows ?? []) as { id: string; financial_entry_id: string | null }[]) {
      if (previous.financial_entry_id) {
        await supabase.from('financial_entries').delete().eq('id', previous.financial_entry_id).eq('wedding_id', wid)
      }
      await supabase
        .from('financial_quotes')
        .update({ is_selected: false, financial_entry_id: null })
        .eq('id', previous.id)
    }

    // 3. Cria o lançamento real no Financeiro a partir do orçamento escolhido
    const { data: entryRow, error: entryError } = await supabase
      .from('financial_entries')
      .insert({
        wedding_id:   wid,
        category:     QUOTE_TYPE_LABELS[quote.type],
        vendor:       quote.vendor_name,
        description:  `Orçamento selecionado: ${quote.vendor_name}`,
        total_amount: quote.amount_cents,
        paid_amount:  0,
      })
      .select()
      .single()

    if (entryError || !entryRow) return err(500, 'DB_ERROR', 'Erro ao criar lançamento financeiro.')

    const entry = entryRow as FinancialEntry

    // 4. Marca este orçamento como selecionado, vinculado ao lançamento criado
    const { data: updatedQuoteRow, error: updateError } = await supabase
      .from('financial_quotes')
      .update({ is_selected: true, financial_entry_id: entry.id })
      .eq('id', quote.id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (updateError) return err(500, 'DB_ERROR', 'Erro ao atualizar orçamento.')
    if (!updatedQuoteRow) return err(404, 'QUOTE_NOT_FOUND', 'Orçamento não encontrado.')

    // 5. Marca a tarefa correspondente do Checklist como concluída, se houver mapeamento
    const catalogKey = CHECKLIST_CATALOG_KEY_BY_TYPE[quote.type]
    if (catalogKey) {
      await supabase
        .from('checklist_items')
        .update({ completed: true })
        .eq('wedding_id', wid)
        .eq('catalog_key', catalogKey)
    }

    return ok({ quote: updatedQuoteRow as FinancialQuote, entry })
  } catch (error) {
    return handleApiError(error)
  }
}
