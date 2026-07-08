import FinancialManager from '@/components/financial/financial-manager'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { FinancialEntry } from '@/types/database'

export default async function FinanceiroPage() {
  const supabase = await createSupabaseServer()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, budget')
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!wedding) {
    return (
      <div
        className="rounded-2xl bg-[var(--surface)] p-10 text-center"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: 'var(--muted-fg)', fontSize: '14px' }}
      >
        Complete o onboarding para começar a controlar o orçamento do casamento.
      </div>
    )
  }

  const { data: entries } = await supabase
    .from('financial_entries')
    .select('*')
    .eq('wedding_id', wedding.id)
    .order('created_at', { ascending: true })

  return (
    <FinancialManager
      weddingId={wedding.id as string}
      budgetCents={(wedding.budget as number | null) ?? null}
      initialEntries={(entries ?? []) as FinancialEntry[]}
    />
  )
}
