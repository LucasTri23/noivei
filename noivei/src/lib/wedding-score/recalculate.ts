import type { SupabaseClient } from '@supabase/supabase-js'
import type { GuestStatus }    from '@/types/database'
import { calculateWeddingScore } from '@/lib/wedding-score/calculator'

const RESPONDED_STATUSES: GuestStatus[] = ['confirmado', 'recusado']

/**
 * Busca os dados necessários (checklist, convidados, orçamento e lançamentos
 * financeiros), calcula o Wedding Score via `calculateWeddingScore` e persiste
 * o resultado em `weddings.wedding_score` / `weddings.score_calculated_at`.
 *
 * Barato o suficiente para rodar a cada carregamento do Dashboard (poucas
 * queries agregadas, sem N+1).
 */
export async function recalculateWeddingScore(
  supabase:  SupabaseClient,
  weddingId: string,
): Promise<number> {
  const [
    { data: checklistItems },
    { data: guests },
    { data: wedding },
    { data: financialEntries },
  ] = await Promise.all([
    supabase
      .from('checklist_items')
      .select('completed')
      .eq('wedding_id', weddingId)
      .eq('is_archived', false)
      .eq('is_dismissed', false),
    supabase
      .from('guests')
      .select('status')
      .eq('wedding_id', weddingId),
    supabase
      .from('weddings')
      .select('budget')
      .eq('id', weddingId)
      .maybeSingle(),
    supabase
      .from('financial_entries')
      .select('total_amount')
      .eq('wedding_id', weddingId),
  ])

  const items   = (checklistItems ?? [])     as { completed: boolean }[]
  const guestList = (guests ?? [])           as { status: GuestStatus }[]
  const entries = (financialEntries ?? [])   as { total_amount: number }[]
  const budget  = (wedding?.budget as number | null | undefined) ?? null

  const score = calculateWeddingScore({
    checklistTotal:      items.length,
    checklistCompleted:  items.filter((item) => item.completed).length,
    guestsTotal:         guestList.length,
    guestsResponded:     guestList.filter((guest) => RESPONDED_STATUSES.includes(guest.status)).length,
    budget,
    financialEntriesSum: entries.reduce((sum, entry) => sum + (entry.total_amount ?? 0), 0),
  })

  await supabase
    .from('weddings')
    .update({ wedding_score: score, score_calculated_at: new Date().toISOString() })
    .eq('id', weddingId)

  return score
}
