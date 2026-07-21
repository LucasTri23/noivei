import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase/server'
import TimelineBoard from '@/components/timeline/timeline-board'
import type { ChecklistItem } from '@/types/database'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export default async function TimelinePage() {
  const supabase = await createSupabaseServer()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, wedding_date, budget')
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  let items: ChecklistItem[] = []
  let budgetSummary: { budgetCents: number; committedCents: number } | null = null

  if (wedding) {
    const { data } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('wedding_id', wedding.id)
      .eq('is_archived', false)
      .eq('is_dismissed', false)
      .order('sort_order')
    items = (data ?? []) as ChecklistItem[]

    const budgetCents = wedding.budget as number | null
    if (budgetCents) {
      const { data: entries } = await supabase
        .from('financial_entries')
        .select('total_amount')
        .eq('wedding_id', wedding.id)

      const committedCents = (entries ?? []).reduce(
        (sum, entry) => sum + (entry.total_amount as number),
        0,
      )
      budgetSummary = { budgetCents, committedCents }
    }
  }

  const hasDate = Boolean(wedding?.wedding_date)

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
        >
          Timeline do casamento
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
          {hasDate
            ? 'Acompanhe cada etapa da sua jornada rumo ao grande dia'
            : 'Defina a data do casamento para ativar os prazos de cada fase'}
        </p>
      </div>

      {/* Resumo de orçamento — sempre o primeiro elemento visível, se houver orçamento definido */}
      {budgetSummary && (
        <div
          className="mb-8 rounded-2xl p-6"
          style={{ background: 'linear-gradient(150deg, #2A1E10, #3A2A18)', color: '#FAF0E6' }}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--wedding-color-light)', marginBottom: '4px' }}>
                Orçamento
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>
                {fmtCurrency(budgetSummary.committedCents)} comprometido de {fmtCurrency(budgetSummary.budgetCents)}
              </div>
            </div>
            <Link
              href="/financeiro"
              style={{
                fontSize: '13px', fontWeight: 600, color: 'var(--wedding-color-light)',
                textDecoration: 'underline', flexShrink: 0,
              }}
            >
              Ver detalhes
            </Link>
          </div>
          <div style={{ height: '8px', borderRadius: '99px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', borderRadius: '99px',
                background: 'linear-gradient(90deg, var(--wedding-color-light), var(--wedding-color))',
                width: `${budgetSummary.budgetCents > 0 ? Math.min(100, Math.round((budgetSummary.committedCents / budgetSummary.budgetCents) * 100)) : 0}%`,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Timeline */}
      <TimelineBoard items={items} weddingId={wedding?.id ?? null} />
    </div>
  )
}
