'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { PLAN_IDS, type PlanId } from '@/constants/plans'

type PremiumBilling = 'monthly' | 'once'

interface PlanSelectorProps {
  userId:         string
  currentPlanId:  PlanId
  subscriptionId: string | null
}

const COMPARISON: { feature: string; free: string; premium: string; plus: string }[] = [
  { feature: 'Casamentos',                    free: '1',                    premium: '1',                     plus: 'Ilimitados (futuro)' },
  { feature: 'Usuários',                      free: '1',                    premium: 'Até 5',                 plus: 'Até 10' },
  { feature: 'Convidados',                    free: 'Até 50',               premium: 'Até 250',               plus: 'Ilimitados' },
  { feature: 'Checklist',                     free: '✅',                   premium: '✅ Inteligente',        plus: '✅ IA personalizada' },
  { feature: 'Timeline',                      free: '✅',                   premium: '✅',                    plus: '✅' },
  { feature: 'Dashboard',                     free: 'Básico',               premium: 'Completo',              plus: 'Completo + Insights' },
  { feature: 'Wedding Score',                 free: '❌',                   premium: '✅',                    plus: '✅ IA' },
  { feature: 'Financeiro',                    free: 'Básico',               premium: 'Completo',              plus: 'Completo + relatórios avançados' },
  { feature: 'RSVP',                          free: 'Até 50 confirmações',  premium: 'Ilimitado',             plus: 'Ilimitado' },
  { feature: 'Site do casal',                 free: '❌',                   premium: '✅',                    plus: '✅ Domínio próprio (futuro)' },
  { feature: 'Lista de presentes',            free: '❌',                   premium: '✅',                    plus: '✅' },
  { feature: 'Organização de mesas',          free: '❌',                   premium: '✅',                    plus: '✅ Distribuição automática' },
  { feature: 'Upload de contratos',           free: '100 MB',               premium: '5 GB',                  plus: '20 GB' },
  { feature: 'Notificações',                  free: 'Básicas',              premium: 'Email + Push',          plus: 'Inteligentes' },
  { feature: 'IA',                            free: '❌',                   premium: 'Sugestões básicas',     plus: 'Assistente completo' },
  { feature: 'Suporte',                       free: 'FAQ',                  premium: 'Email',                 plus: 'Prioritário' },
  { feature: 'Exportação PDF/Excel',          free: '❌',                   premium: '✅',                    plus: '✅' },
  { feature: 'Personalização',                free: 'Básica',               premium: 'Média',                 plus: 'Completa' },
  { feature: 'Remover "Feito com Noivei"',    free: '❌',                   premium: '✅',                    plus: '✅' },
  { feature: 'Backup',                        free: '❌',                   premium: 'Automático',            plus: 'Avançado' },
]

const cellStyle: React.CSSProperties = {
  padding: '11px 14px', fontSize: '13px', color: '#3C2818',
  borderBottom: '1px solid #F8F3EE', textAlign: 'center', minWidth: '130px',
}

export default function PlanSelector({ userId, currentPlanId, subscriptionId }: PlanSelectorProps) {
  const router = useRouter()
  const [premiumBilling, setPremiumBilling] = useState<PremiumBilling>(
    currentPlanId === PLAN_IDS.PREMIUM_ONCE ? 'once' : 'monthly',
  )
  const [switching, setSwitching] = useState<PlanId | null>(null)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')

  const premiumTarget: PlanId = premiumBilling === 'monthly' ? PLAN_IDS.PREMIUM_MONTHLY : PLAN_IDS.PREMIUM_ONCE

  async function selectPlan(planId: PlanId) {
    setSwitching(planId)
    setError('')
    setSuccess('')

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
      setError('Não foi possível trocar de plano. Tente novamente.')
      return
    }
    setSuccess('Plano atualizado com sucesso!')
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
          <span className="font-display" style={{ fontSize: '32px', fontWeight: 600, color: '#3C2818' }}>R$ 0</span>
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
                    color: active ? 'var(--wedding-color-dark)' : '#9A7A60',
                    fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.18s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {premiumBilling === 'monthly' ? (
            <span className="font-display" style={{ fontSize: '32px', fontWeight: 600, color: '#3C2818' }}>
              R$ 29,90<span style={{ fontSize: '15px', color: '#9A7A60', fontFamily: 'var(--font-body)' }}>/mês</span>
            </span>
          ) : (
            <div>
              <span className="font-display" style={{ fontSize: '32px', fontWeight: 600, color: '#3C2818' }}>R$ 149,90</span>
              <div style={{ fontSize: '12px', color: '#9A7A60' }}>Pagamento único — válido até 1 ano após o casamento</div>
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
          <span className="font-display" style={{ fontSize: '32px', fontWeight: 600, color: '#3C2818' }}>R$ 299,00</span>
          <div style={{ fontSize: '12px', color: '#9A7A60' }}>Pagamento único — válido por um período após o casamento</div>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px,1fr))' }}>
        {cards.map((card) => {
          const isCurrent = card.target === currentPlanId
          const isLoading = switching === card.target
          return (
            <div
              key={card.key}
              className="rounded-2xl bg-white p-6 flex flex-col"
              style={{
                boxShadow: card.highlight
                  ? '0 12px 30px color-mix(in srgb, var(--wedding-color) 22%, transparent)'
                  : '0 8px 22px rgba(60,40,24,0.06)',
                border: card.highlight ? '1.5px solid var(--wedding-color)' : '1.5px solid transparent',
                position: 'relative',
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
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#9A7A60', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
                {card.emoji} {card.name}
              </div>
              <div style={{ marginBottom: '10px' }}>{card.priceNode}</div>
              <p style={{ fontSize: '13px', color: '#9A7A60', lineHeight: 1.5, margin: '0 0 16px', flex: 1 }}>
                {card.desc}
              </p>
              <button
                type="button"
                disabled={isCurrent || switching !== null}
                onClick={() => selectPlan(card.target)}
                style={{
                  width: '100%', border: 'none', borderRadius: '12px', padding: '13px',
                  fontWeight: 700, fontSize: '14px',
                  background: isCurrent ? '#F1EAE2' : 'var(--wedding-color)',
                  color: isCurrent ? '#9A7A60' : '#fff',
                  cursor: isCurrent || switching !== null ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  boxShadow: isCurrent ? 'none' : '0 8px 20px color-mix(in srgb, var(--wedding-color) 28%, transparent)',
                }}
              >
                {isCurrent ? 'Plano atual' : isLoading ? 'Alterando…' : card.key === 'free' ? 'Usar plano Gratuito' : 'Assinar'}
              </button>
            </div>
          )
        })}
      </div>

      {error && (
        <p style={{ fontSize: '13.5px', color: '#C0553F', background: '#FBEEE6', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px' }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ fontSize: '13.5px', color: '#5E8B6A', background: '#E9EFE6', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px' }}>
          {success}
        </p>
      )}

      {/* Comparison table */}
      <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...cellStyle, textAlign: 'left', fontWeight: 700, minWidth: '160px', background: '#FDFAF6' }}>Recurso</th>
                <th style={{ ...cellStyle, fontWeight: 700, background: '#FDFAF6' }}>🆓 Gratuito</th>
                <th style={{ ...cellStyle, fontWeight: 700, background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)' }}>💎 Premium</th>
                <th style={{ ...cellStyle, fontWeight: 700, background: '#FDFAF6' }}>👑 Premium Plus</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, idx) => (
                <tr key={row.feature}>
                  <td style={{ ...cellStyle, textAlign: 'left', fontWeight: 600, borderBottom: idx < COMPARISON.length - 1 ? '1px solid #F8F3EE' : 'none' }}>
                    {row.feature}
                  </td>
                  <td style={{ ...cellStyle, color: '#9A7A60', borderBottom: idx < COMPARISON.length - 1 ? '1px solid #F8F3EE' : 'none' }}>{row.free}</td>
                  <td style={{ ...cellStyle, background: 'color-mix(in srgb, var(--wedding-color-subtle) 45%, transparent)', borderBottom: idx < COMPARISON.length - 1 ? '1px solid #F8F3EE' : 'none' }}>{row.premium}</td>
                  <td style={{ ...cellStyle, borderBottom: idx < COMPARISON.length - 1 ? '1px solid #F8F3EE' : 'none' }}>{row.plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
