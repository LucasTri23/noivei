import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { CreateInstallmentPlanSchema } from '@/lib/api/validation/financial-installment.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { recalcInstallmentsPaidAmount } from '@/lib/financial/recalc-paid-amount'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { FinancialEntry, FinancialInstallment } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'financeiro')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'ENTRY_NOT_FOUND', 'Lançamento não encontrado.')
    }

    const { data: entry, error: entryError } = await supabase
      .from('financial_entries')
      .select('id')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (entryError) return err(500, 'DB_ERROR', 'Erro ao buscar lançamento.')
    if (!entry) return err(404, 'ENTRY_NOT_FOUND', 'Lançamento não encontrado.')

    const { data, error } = await supabase
      .from('financial_installments')
      .select('*')
      .eq('financial_entry_id', id)
      .eq('wedding_id', wid)
      .order('installment_number', { ascending: true })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar parcelas.')

    return ok((data ?? []) as FinancialInstallment[])
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'financeiro')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'ENTRY_NOT_FOUND', 'Lançamento não encontrado.')
    }

    const body = await parseJsonBody(req)
    const parsed = CreateInstallmentPlanSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data: entryRow, error: entryError } = await supabase
      .from('financial_entries')
      .select('id, total_amount')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (entryError) return err(500, 'DB_ERROR', 'Erro ao buscar lançamento.')
    if (!entryRow) return err(404, 'ENTRY_NOT_FOUND', 'Lançamento não encontrado.')

    const entry = entryRow as Pick<FinancialEntry, 'id' | 'total_amount'>
    const { installments } = parsed.data
    const sum = installments.reduce((total, item) => total + item.amount_cents, 0)

    if (sum !== entry.total_amount) {
      return err(400, 'INSTALLMENTS_SUM_MISMATCH', 'A soma das parcelas não bate com o valor total do lançamento.', {
        expected:   entry.total_amount,
        received:   sum,
        difference: sum - entry.total_amount,
      })
    }

    // Regenera o plano inteiro em vez de editar incrementalmente — mais simples e evita
    // ficar com parcelas órfãs se o número de parcelas mudar entre uma tentativa e outra.
    const { error: deleteError } = await supabase
      .from('financial_installments')
      .delete()
      .eq('financial_entry_id', id)
      .eq('wedding_id', wid)

    if (deleteError) return err(500, 'DB_ERROR', 'Erro ao regenerar plano de parcelas.')

    const rows = installments.map((item, index) => ({
      wedding_id:         wid,
      financial_entry_id: id,
      installment_number: index + 1,
      total_installments: installments.length,
      amount_cents:       item.amount_cents,
      due_date:           item.due_date,
    }))

    const { data, error: insertError } = await supabase
      .from('financial_installments')
      .insert(rows)
      .select()
      .order('installment_number', { ascending: true })

    if (insertError) return err(500, 'DB_ERROR', 'Erro ao criar parcelas.')

    await recalcInstallmentsPaidAmount(supabase, wid, id)

    return ok((data ?? []) as FinancialInstallment[], undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
