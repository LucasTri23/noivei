import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateInstallmentSchema } from '@/lib/api/validation/financial-installment.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { recalcInstallmentsPaidAmount } from '@/lib/financial/recalc-paid-amount'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { FinancialInstallment } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string; installmentId: string }>
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id, installmentId } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'financeiro')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'ENTRY_NOT_FOUND', 'Lançamento não encontrado.')
    }
    if (!UuidSchema.safeParse(installmentId).success) {
      return err(404, 'INSTALLMENT_NOT_FOUND', 'Parcela não encontrada.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateInstallmentSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data: existing, error: fetchError } = await supabase
      .from('financial_installments')
      .select('id')
      .eq('id', installmentId)
      .eq('financial_entry_id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao buscar parcela.')
    if (!existing) return err(404, 'INSTALLMENT_NOT_FOUND', 'Parcela não encontrada.')

    const { paid } = parsed.data
    const { data, error } = await supabase
      .from('financial_installments')
      .update({ paid, paid_at: paid ? new Date().toISOString() : null })
      .eq('id', installmentId)
      .eq('financial_entry_id', id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar parcela.')
    if (!data) return err(404, 'INSTALLMENT_NOT_FOUND', 'Parcela não encontrada.')

    await recalcInstallmentsPaidAmount(supabase, wid, id)

    return ok(data as FinancialInstallment)
  } catch (error) {
    return handleApiError(error)
  }
}
