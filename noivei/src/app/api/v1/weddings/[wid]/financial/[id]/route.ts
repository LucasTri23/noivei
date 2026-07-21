import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateFinancialEntrySchema } from '@/lib/api/validation/financial.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { CHECKLIST_CATALOG_KEY_BY_TYPE } from '@/lib/financial/checklist-catalog'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { FinancialEntry, FinancialQuote } from '@/types/database'

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
      return err(404, 'ENTRY_NOT_FOUND', 'Lançamento não encontrado.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateFinancialEntrySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data: existing, error: fetchError } = await supabase
      .from('financial_entries')
      .select('total_amount, paid_amount')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao buscar lançamento.')
    if (!existing) return err(404, 'ENTRY_NOT_FOUND', 'Lançamento não encontrado.')

    const current = existing as Pick<FinancialEntry, 'total_amount' | 'paid_amount'>
    const nextTotal = parsed.data.total_amount ?? current.total_amount
    const nextPaid = parsed.data.paid_amount ?? current.paid_amount
    if (nextPaid > nextTotal) {
      return err(400, 'PAID_EXCEEDS_TOTAL', 'Valor pago não pode exceder o valor total.')
    }

    const { data, error } = await supabase
      .from('financial_entries')
      .update(parsed.data)
      .eq('id', id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar lançamento.')
    if (!data) return err(404, 'ENTRY_NOT_FOUND', 'Lançamento não encontrado.')

    return ok(data as FinancialEntry)
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
      return err(404, 'ENTRY_NOT_FOUND', 'Lançamento não encontrado.')
    }

    // Se este lançamento veio de um orçamento selecionado, desfaz a seleção e reverte
    // a tarefa do Checklist ANTES de apagar o lançamento — depois de apagado, o
    // ON DELETE SET NULL já limpa financial_entry_id em financial_quotes sozinho, mas
    // aí perderíamos a referência ao `type` do orçamento pra saber qual tarefa reverter.
    const { data: linkedQuote, error: quoteError } = await supabase
      .from('financial_quotes')
      .select('id, type')
      .eq('financial_entry_id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (quoteError) return err(500, 'DB_ERROR', 'Erro ao buscar orçamento vinculado.')

    if (linkedQuote) {
      const quote = linkedQuote as Pick<FinancialQuote, 'id' | 'type'>

      await supabase
        .from('financial_quotes')
        .update({ is_selected: false, financial_entry_id: null })
        .eq('id', quote.id)

      const catalogKey = CHECKLIST_CATALOG_KEY_BY_TYPE[quote.type]
      if (catalogKey) {
        await supabase
          .from('checklist_items')
          .update({ completed: false })
          .eq('wedding_id', wid)
          .eq('catalog_key', catalogKey)
      }
    }

    const { data, error } = await supabase
      .from('financial_entries')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover lançamento.')
    if (!data) return err(404, 'ENTRY_NOT_FOUND', 'Lançamento não encontrado.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
