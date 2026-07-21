import FinancialManager from '@/components/financial/financial-manager'
import { checkFinancialEntryLimit, resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { isPaidPlan, type PlanId } from '@/constants/plans'
import type { FinancialEntry, FinancialQuote } from '@/types/database'

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

  // As três consultas abaixo só dependem de wedding.id, não uma da outra —
  // rodar em paralelo poupa round-trips no carregamento da página.
  const [{ data: entries }, planId, limitCheck] = await Promise.all([
    supabase
      .from('financial_entries')
      .select('*')
      .eq('wedding_id', wedding.id)
      .order('created_at', { ascending: true }),
    resolveWeddingPlanId(supabase, wedding.id as string),
    checkFinancialEntryLimit(supabase, wedding.id as string),
  ])

  // Orçamentos é recurso Premium+ — só busca se o plano já resolvido permitir,
  // pra não gastar uma consulta à toa em toda carga de página no Gratuito.
  const quotes = isPaidPlan(planId as PlanId)
    ? (
        await supabase
          .from('financial_quotes')
          .select('*')
          .eq('wedding_id', wedding.id)
          .order('created_at', { ascending: true })
      ).data
    : null

  return (
    <FinancialManager
      weddingId={wedding.id as string}
      budgetCents={(wedding.budget as number | null) ?? null}
      initialEntries={(entries ?? []) as FinancialEntry[]}
      initialQuotes={(quotes ?? []) as FinancialQuote[]}
      planId={planId as PlanId}
      entryLimit={limitCheck.limit}
    />
  )
}
