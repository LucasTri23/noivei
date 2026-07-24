'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'
import Spinner from '@/components/ui/spinner'
import { effectiveGroupKey } from '@/lib/billing/plan-groups'
import type { PlanFeature, PlanFeatureCategory, PlanFeatureValue } from '@/types/database'

export interface Plan {
  id:            string
  name:          string
  description:   string | null
  price_brl:     number
  group_key:     string | null
  billing_label: string | null
  billing_note:  string | null
  emoji:         string
  highlight:     boolean
}

interface PlanSelectorProps {
  userId:         string
  currentPlanId:  string
  subscriptionId: string | null
  // Catálogo inteiro vem do banco (só planos ativos, ver perfil/planos/page.tsx) —
  // nenhum card/id fixo no componente. Planos com o mesmo group_key viram variantes
  // de cobrança (toggle) do mesmo card; ver src/lib/billing/plan-groups.ts.
  plans:      Plan[]
  categories: PlanFeatureCategory[]
  features:   PlanFeature[]
  values:     PlanFeatureValue[]
}

function formatBrl(cents: number | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function featureLine(label: string, value: string): { text: string; included: boolean } {
  if (value === '❌') return { text: label, included: false }
  if (value === '✅') return { text: label, included: true }
  return { text: `${label}: ${value.replace(/^✅\s*/, '')}`, included: true }
}

function groupPlans(plans: Plan[]): Map<string, Plan[]> {
  const groups = new Map<string, Plan[]>()
  for (const plan of plans) {
    const key = effectiveGroupKey(plan)
    const list = groups.get(key) ?? []
    list.push(plan)
    groups.set(key, list)
  }
  return groups
}

export default function PlanSelector({ userId, currentPlanId, subscriptionId, plans, categories, features, values }: PlanSelectorProps) {
  const router = useRouter()
  const groupedPlans = groupPlans(plans)

  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const [groupKey, variants] of groupedPlans) {
      const current = variants.find((v) => v.id === currentPlanId)
      // variants nunca é vazio — groupPlans só cria a entrada ao dar push do 1º item.
      initial[groupKey] = current?.id ?? variants[0]!.id
    }
    return initial
  })
  const [switching, setSwitching] = useState<string | null>(null)
  const showSpinner = useDelayedLoading(switching !== null)

  const [couponCode, setCouponCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  const valueByFeatureAndGroup = new Map(values.map((v) => [`${v.feature_id}:${v.group_key}`, v.value]))
  const featuresByCategory = new Map<string, PlanFeature[]>()
  features.forEach((feature) => {
    const list = featuresByCategory.get(feature.category_id) ?? []
    list.push(feature)
    featuresByCategory.set(feature.category_id, list)
  })

  async function redeemCoupon() {
    if (!couponCode.trim()) return
    setRedeeming(true)
    const res = await fetch('/api/v1/coupons/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: couponCode.trim() }),
    })
    const body = await res.json().catch(() => null)
    setRedeeming(false)

    if (!res.ok) {
      toastError(body?.error?.message ?? 'Não foi possível aplicar esse cupom.')
      return
    }
    toastSuccess(body?.data?.message ?? 'Cupom aplicado!')
    setCouponCode('')
    router.refresh()
  }

  async function selectPlan(planId: string) {
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

  return (
    <div>
      {/* Cards */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', paddingTop: '14px' }}>
        {Array.from(groupedPlans.entries()).map(([groupKey, variants]) => {
          // variants nunca é vazio — mesma garantia de groupPlans.
          const firstVariant = variants[0]!
          const activeId = selectedVariant[groupKey] ?? firstVariant.id
          const activePlan = variants.find((v) => v.id === activeId) ?? firstVariant
          const isCurrent = activePlan.id === currentPlanId
          const isSwitchingThis = switching === activePlan.id

          return (
            <div
              key={groupKey}
              className="rounded-2xl bg-[var(--surface)] p-6 flex flex-col"
              style={{
                boxShadow: activePlan.highlight
                  ? '0 16px 36px color-mix(in srgb, var(--wedding-color) 24%, transparent)'
                  : '0 8px 22px rgba(60,40,24,0.06)',
                border: activePlan.highlight ? '1.5px solid var(--wedding-color)' : '1.5px solid transparent',
                position: 'relative',
                transform: activePlan.highlight ? 'scale(1.02)' : 'none',
              }}
            >
              {activePlan.highlight && (
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
                {activePlan.emoji} {activePlan.name}
              </div>

              <div style={{ marginBottom: '12px' }}>
                {variants.length > 1 && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    {variants.map((variant) => {
                      const active = variant.id === activeId
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => setSelectedVariant((prev) => ({ ...prev, [groupKey]: variant.id }))}
                          style={{
                            flex: 1, padding: '7px 8px', borderRadius: '9px', fontSize: '12px', minWidth: '90px',
                            border: `1.5px solid ${active ? 'var(--wedding-color)' : '#EBDDD0'}`,
                            background: active ? 'var(--wedding-color-subtle)' : 'transparent',
                            color: active ? 'var(--wedding-color-dark)' : 'var(--muted-fg)',
                            fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.18s',
                          }}
                        >
                          {variant.billing_label ?? variant.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                <span className="font-display" style={{ fontSize: '32px', fontWeight: 600, color: 'var(--fg)' }}>
                  {formatBrl(activePlan.price_brl)}
                  {activePlan.billing_note?.startsWith('/') && (
                    <span style={{ fontSize: '15px', color: 'var(--muted-fg)', fontFamily: 'var(--font-body)' }}>{activePlan.billing_note}</span>
                  )}
                </span>
                {activePlan.billing_note && !activePlan.billing_note.startsWith('/') && (
                  <div style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>{activePlan.billing_note}</div>
                )}
              </div>

              <p style={{ fontSize: '13px', color: 'var(--muted-fg)', lineHeight: 1.5, margin: '0 0 14px' }}>
                {activePlan.description}
              </p>

              <div style={{ flex: 1, marginBottom: '20px' }}>
                {categories.map((category) => {
                  const rows = featuresByCategory.get(category.id) ?? []
                  if (rows.length === 0) return null
                  return (
                    <div key={category.id} style={{ marginBottom: '16px' }}>
                      <div style={{
                        fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--muted-fg)', marginBottom: '8px',
                      }}>
                        {category.title}
                      </div>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        {rows.map((feature) => {
                          const rawValue = valueByFeatureAndGroup.get(`${feature.id}:${groupKey}`) ?? '❌'
                          const { text, included } = featureLine(feature.label, rawValue)
                          return (
                            <li
                              key={feature.id}
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
                  )
                })}
              </div>

              <button
                type="button"
                disabled={isCurrent || switching !== null}
                onClick={() => selectPlan(activePlan.id)}
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
                {isCurrent ? 'Plano atual' : isSwitchingThis ? 'Alterando…' : activePlan.price_brl === 0 ? 'Usar plano Gratuito' : 'Assinar'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Cupom */}
      <div className="rounded-2xl bg-[var(--surface)] p-5" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)', display: 'block', marginBottom: '6px' }}>
            Tenho um cupom
          </label>
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="Ex: BEMVINDO10"
            style={{
              border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '11px 14px',
              fontSize: '14px', color: 'var(--fg)', background: 'var(--bg)', outline: 'none', width: '100%',
            }}
          />
        </div>
        <button
          type="button"
          disabled={redeeming || !couponCode.trim()}
          onClick={redeemCoupon}
          style={{
            border: 'none', borderRadius: '12px', padding: '12px 20px', fontWeight: 700, fontSize: '14px',
            background: 'var(--wedding-color)', color: '#fff',
            cursor: redeeming || !couponCode.trim() ? 'not-allowed' : 'pointer',
            opacity: redeeming || !couponCode.trim() ? 0.6 : 1,
          }}
        >
          {redeeming ? 'Aplicando…' : 'Aplicar cupom'}
        </button>
      </div>
    </div>
  )
}
