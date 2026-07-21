import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Recalcula financial_entries.paid_amount como a soma de amount_cents das parcelas
 * pagas do lançamento e persiste o novo valor. Chamado depois de criar/regenerar um
 * plano de parcelas e depois de alternar o status pago de uma parcela — mantém o hero
 * card e o painel "Por categoria" corretos sem precisar de trigger de banco.
 */
export async function recalcInstallmentsPaidAmount(
  supabase:         SupabaseClient,
  weddingId:        string,
  financialEntryId: string,
): Promise<void> {
  const { data: paidRows } = await supabase
    .from('financial_installments')
    .select('amount_cents')
    .eq('financial_entry_id', financialEntryId)
    .eq('wedding_id', weddingId)
    .eq('paid', true)

  const paidAmount = ((paidRows ?? []) as { amount_cents: number }[])
    .reduce((sum, row) => sum + row.amount_cents, 0)

  await supabase
    .from('financial_entries')
    .update({ paid_amount: paidAmount })
    .eq('id', financialEntryId)
    .eq('wedding_id', weddingId)
}
