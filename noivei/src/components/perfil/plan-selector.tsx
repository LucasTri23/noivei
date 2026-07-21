'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'
import Spinner from '@/components/ui/spinner'
import { PLAN_IDS, type PlanId } from '@/constants/plans'

type PremiumBilling = 'monthly' | 'once'

interface PlanSelectorProps {
  userId:         string
  currentPlanId:  PlanId
  subscriptionId: string | null
  // Preços em centavos, vindos da tabela `plans` — nunca hardcoded no componente
  prices:         Partial<Record<PlanId, number>>
}

function formatBrl(cents: number | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

interface ComparisonRow {
  feature: string
  free:    string
  premium: string
  plus:    string
}

interface ComparisonCategory {
  title: string
  rows:  ComparisonRow[]
}

// Sem a linha "Casamentos": o login aqui é do casal (noivo/noiva), sempre 1 casamento por conta.
// Múltiplos casamentos por conta (cerimonialista) é escopo de uma versão futura do produto.
const CATEGORIES: ComparisonCategory[] = [
  {
    title: 'Limites',
    rows: [
      { feature: 'Usuários',            free: '1',                    premium: 'Até 5',             plus: 'Até 10' },
      { feature: 'Convidados',           free: 'Até 50',               premium: 'Até 250',           plus: 'Ilimitados' },
      { feature: 'Upload de contratos',  free: '100 MB',               premium: '5 GB',              plus: '20 GB' },
    ],
  },
  {
    title: 'Planejamento',
    rows: [
      { feature: 'Checklist',      free: '✅',     premium: '✅ Inteligente', plus: '✅ IA personalizada' },
      { feature: 'Timeline',       free: '✅',     premium: '✅',             plus: '✅' },
      { feature: 'Dashboard',      free: 'Básico', premium: 'Completo',      plus: 'Completo + Insights' },
      { feature: 'Wedding Score',  free: '❌',     premium: '✅',             plus: '✅ IA' },
      { feature: 'Financeiro',     free: 'Básico', premium: 'Completo',      plus: 'Completo + relatórios avançados' },
    ],
  },
  {
    title: 'Convidados & site',
    rows: [
      { feature: 'RSVP',                     free: 'Até 50 confirmações', premium: 'Ilimitado', plus: 'Ilimitado' },
      { feature: 'Site do casal',             free: '❌', premium: '✅', plus: '✅ Domínio próprio (futuro)' },
      { feature: 'Lista de presentes',        free: '❌', premium: '✅', plus: '✅' },
      { feature: 'Organização de mesas',      free: '❌', premium: '✅', plus: '✅ Distribuição automática' },
    ],
  },
  {
    title: 'Suporte & personalização',
    rows: [
      { feature: 'Notificações',                free: 'Básicas', premium: 'Email + Push',      plus: 'Inteligentes' },
      { feature: 'IA',                           free: '❌',      premium: 'Sugestões básicas', plus: 'Assistente completo' },
      { feature: 'Suporte',                      free: 'FAQ',     premium: 'Email',             plus: 'Prioritário' },
      { feature: 'Exportação PDF/Excel',         free: '❌',      premium: '✅',                plus: '✅' },
      { feature: 'Personalização',               free: 'Básica',  premium: 'Média',             plus: 'Completa' },
      { feature: 'Remover "Feito com Wednest"',  free: '❌',      premium: '✅',                plus: '✅' },
      { feature: 'Backup',                       free: '❌',      premium: 'Automático',        plus: 'Avançado' },
    ],
  },
]

function featureLine(label: string, value: string): { text: string; included: boolean } {
  if (value === '❌') return { text: label, included: false }
  if (value === '✅') return { text: label, included: true }
  return { text: `${label}: ${value.replace(/^✅\s*/, '')}`, included: true }
}

export default function PlanSelector({ userId, currentPlanId, subscriptionId, prices }: PlanSelectorProps) {
  const router = useRouter()
  const [premiumBilling, setPremiumBilling] = useState<PremiumBilling>(
    currentPlanId === PLAN_IDS.PREMIUM_ONCE ? 'once' : 'monthly',
  )
  const [switching, setSwitching] = useState<PlanId | null>(null)
  const showSpinner = useDelayedLoading(switching !== null)

  const premiumTarget: PlanId = premiumBilling === 'monthly' ? PLAN_IDS.PREMIUM_MONTHLY : PLAN_IDS.PREMIUM_ONCE

  async function selectPlan(planId: PlanId) {
    setSwitching(planId)

    // TODO Fase 2: integrar gateway de pagamento real (Stripe/Pagar.me) antes de processar cobrança de verdade
    const supabase = createSupabaseBrowser()
    const { error: dbError } = subscriptionId
      ? await supabase
          .from('subscriptions')
          .update({ plan_id: planId, status: 'active' })
          .eq('id', subscriptionId)
      : await supabase
          .from('subscriptions')
          .insert({ user_id: userId, plan_id: planId, status: 'active' })

    setSwitching(null)
    if (dbError) {
      toastError('Não foi possível trocar de plano. Tente novamente.')
      return
    }
    toastSuccess('Plano atualizado com sucesso!')
    router.refresh()
  }

  interface CardConfig {
    key:        'free' | 'premium' | 'plus'
    emoji:      string
    name:       string
    target:     PlanId
    highlight:  boolean
    desc:       string
    priceNode:  React.ReactNode
  }

  const cards: CardConfig[] = [
    {
      key: 'free',
      emoji: '🆓',
      name: 'Gratuito',
      target: PLAN_IDS.FREE,
      highlight: false,
      desc: 'Ideal para conhecer a plataforma.',
      priceNode: (
        <div>
          <span className="font-display" style={{ fontSize: '32px', fontWeight: 600, color: 'var(--fg)' }}>{formatBrl(prices[PLAN_IDS.FREE])}</span>
        </div>
      ),
    },
    {
      key: 'premium',
      emoji: '💎',
      name: 'Premium',
      target: premiumTarget,
      highlight: true,
      desc: 'Esse é o plano que a maioria dos casais escolhe.',
      priceNode: (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {([
              { value: 'monthly', label: 'Mensal' },
              { value: 'once',    label: 'Pagamento único' },
            ] as { value: PremiumBilling; label: string }[]).map(({ value, label }) => {
              const active = premiumBilling === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPremiumBilling(value)}
                  style={{
                    flex: 1, padding: '7px 8px', borderRadius: '9px', fontSize: '12px',
                    border: `1.5px solid ${active ? 'var(--wedding-color)' : '#EBDDD0'}`,
                    background: active ? 'var(--wedding-color-subtle)' : 'transparent',
                    color: active ? 'var(--wedding-color-dark)' : 'var(--muted-fg)',
                    fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.18s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {premiumBilling === 'monthly' ? (
            <span className="font-display" style={{ fontSize: '32px', fontWeight: 600, color: 'var(--fg)' }}>
              {formatBrl(prices[PLAN_IDS.PREMIUM_MONTHLY])}<span style={{ fontSize: '15px', color: 'var(--muted-fg)', fontFamily: 'var(--font-body)' }}>/mês</span>
            </span>
          ) : (
            <div>
              <span className="font-display" style={{ fontSize: '32px', fontWeight: 600, color: 'var(--fg)' }}>{formatBrl(prices[PLAN_IDS.PREMIUM_ONCE])}</span>
              <div style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>Pagamento único — válido até 1 ano após o casamento</div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'plus',
      emoji: '👑',
      name: 'Premium Plus',
      target: PLAN_IDS.PLUS_ONCE,
      highlight: false,
      desc: 'Indicado para quem quer tudo liberado, IA completa, mais armazenamento e personalização.',
      priceNode: (
        <div>
          <span className="font-display" style={{ fontSize: '32px', fontWeight: 600, color: 'var(--fg)' }}>{formatBrl(prices[PLAN_IDS.PLUS_ONCE])}</span>
          <div style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>Pagamento único — válido por um período após o casamento</div>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Cards */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', paddingTop: '14px' }}>
        {cards.map((card) => {
          const isCurrent = card.target === currentPlanId
          const isSwitchingThis = switching === card.target

          return (
            <div
              key={card.key}
              className="rounded-2xl bg-[var(--surface)] p-6 flex flex-col"
              style={{
                boxShadow: card.highlight
                  ? '0 16px 36px color-mix(in srgb, var(--wedding-color) 24%, transparent)'
                  : '0 8px 22px rgba(60,40,24,0.06)',
                border: card.highlight ? '1.5px solid var(--wedding-color)' : '1.5px solid transparent',
                position: 'relative',
                transform: card.highlight ? 'scale(1.02)' : 'none',
              }}
            >
              {card.highlight && (
                <span
                  style={{
                    position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)',
                    fontSize: '10px', fontWeight: 700, padding: '3px 12px', borderRadius: '99px',
                    background: 'var(--wedding-color)', color: '#fff', letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  MAIS ESCOLHIDO
                </span>
              )}
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted-fg)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                {card.emoji} {card.name}
              </div>
              <div style={{ marginBottom: '12px' }}>{card.priceNode}</div>
              <p style={{ fontSize: '13px', color: 'var(--muted-fg)', lineHeight: 1.5, margin: '0 0 14px' }}>
                {card.desc}
              </p>

              <div style={{ flex: 1, marginBottom: '20px' }}>
                {CATEGORIES.map((category) => (
                  <div key={category.title} style={{ marginBottom: '16px' }}>
                    <div style={{
                      fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'var(--muted-fg)', marginBottom: '8px',
                    }}>
                      {category.title}
                    </div>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {category.rows.map((row) => {
                        const { text, included } = featureLine(row.feature, row[card.key])
                        return (
                          <li
                            key={row.feature}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px',
                              color: included ? 'var(--fg)' : 'var(--muted-fg)',
                              opacity: included ? 1 : 0.6,
                            }}
                          >
                            <span style={{ color: included ? 'var(--wedding-color)' : 'var(--muted-fg)', fontWeight: 700, lineHeight: 1.4, flexShrink: 0 }}>
                              {included ? '✓' : '✕'}
                            </span>
                            <span>{text}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={isCurrent || switching !== null}
                onClick={() => selectPlan(card.target)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                  width: '100%', border: 'none', borderRadius: '12px', padding: '13px',
                  fontWeight: 700, fontSize: '14px',
                  background: isCurrent ? '#F1EAE2' : 'var(--wedding-color)',
                  color: isCurrent ? 'var(--muted-fg)' : '#fff',
                  cursor: isCurrent || switching !== null ? 'not-allowed' : 'pointer',
                  opacity: switching !== null && !isSwitchingThis ? 0.6 : 1,
                  boxShadow: isCurrent ? 'none' : '0 8px 20px color-mix(in srgb, var(--wedding-color) 28%, transparent)',
                }}
              >
                {isSwitchingThis && showSpinner && <Spinner size={15} color={isCurrent ? 'var(--muted-fg)' : '#fff'} />}
                {isCurrent ? 'Plano atual' : isSwitchingThis ? 'Alterando…' : card.key === 'free' ? 'Usar plano Gratuito' : 'Assinar'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
