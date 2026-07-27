'use client'

import { groupPlans } from '@/lib/billing/plan-groups'
import Spinner from '@/components/ui/spinner'
import type { PlanFeature, PlanFeatureCategory, PlanFeatureValue } from '@/types/database'

export interface PlanCardPlan {
  id:               string
  name:             string
  description:      string | null
  price_brl:        number
  group_key:        string | null
  billing_label:    string | null
  billing_note:     string | null
  emoji:            string
  highlight:        boolean
  billing_interval: 'once' | 'monthly'
}

export interface PlanCardsGridProps {
  plans:      PlanCardPlan[]
  categories: PlanFeatureCategory[]
  features:   PlanFeature[]
  values:     PlanFeatureValue[]
  // Qual variante mostrar em cada card com toggle (mensal/único) — controlado
  // pelo chamador pra poder inicializar de acordo com o plano vigente do usuário.
  selectedVariant:   Record<string, string>
  onToggleVariant:   (groupKey: string, variantId: string) => void
  // Se este plano é o "escolhido" no contexto do chamador (plano atual da
  // assinatura, ou plano marcado no wizard de onboarding) — controla o rótulo/
  // desabilitação do botão de ação, não a exibição do card em si.
  isActive:          (plan: PlanCardPlan) => boolean
  actionLabel:       (plan: PlanCardPlan, active: boolean) => string
  actionDisabled:    (plan: PlanCardPlan, active: boolean) => boolean
  actionShowSpinner?: (plan: PlanCardPlan) => boolean
  onAction:          (plan: PlanCardPlan) => void
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

// Grade de cards de planos agrupados por group_key (toggle de cobrança) com a
// comparação completa de recursos — usada tanto em /perfil/planos (ação =
// trocar de plano na hora) quanto no onboarding (ação = só marcar a escolha,
// o pagamento de verdade acontece depois em finish()).
export default function PlanCardsGrid({
  plans, categories, features, values,
  selectedVariant, onToggleVariant,
  isActive, actionLabel, actionDisabled, actionShowSpinner, onAction,
}: PlanCardsGridProps) {
  const groupedPlans = groupPlans(plans)

  const valueByFeatureAndGroup = new Map(values.map((v) => [`${v.feature_id}:${v.group_key}`, v.value]))
  const featuresByCategory = new Map<string, PlanFeature[]>()
  features.forEach((feature) => {
    const list = featuresByCategory.get(feature.category_id) ?? []
    list.push(feature)
    featuresByCategory.set(feature.category_id, list)
  })

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', paddingTop: '14px' }}>
      {Array.from(groupedPlans.entries()).map(([groupKey, variants]) => {
        // variants nunca é vazio — groupPlans só cria a entrada ao dar push do 1º item.
        const firstVariant = variants[0]!
        const activeId = selectedVariant[groupKey] ?? firstVariant.id
        const activePlan = variants.find((v) => v.id === activeId) ?? firstVariant
        const active = isActive(activePlan)
        const disabled = actionDisabled(activePlan, active)
        const showSpinner = actionShowSpinner?.(activePlan) ?? false

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
                    const variantActive = variant.id === activeId
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => onToggleVariant(groupKey, variant.id)}
                        style={{
                          flex: 1, padding: '7px 8px', borderRadius: '9px', fontSize: '12px', minWidth: '90px',
                          border: `1.5px solid ${variantActive ? 'var(--wedding-color)' : '#EBDDD0'}`,
                          background: variantActive ? 'var(--wedding-color-subtle)' : 'transparent',
                          color: variantActive ? 'var(--wedding-color-dark)' : 'var(--muted-fg)',
                          fontWeight: variantActive ? 700 : 500, cursor: 'pointer', transition: 'all 0.18s',
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
              disabled={disabled}
              onClick={() => onAction(activePlan)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                width: '100%', border: 'none', borderRadius: '12px', padding: '13px',
                fontWeight: 700, fontSize: '14px',
                background: active ? '#F1EAE2' : 'var(--wedding-color)',
                color: active ? 'var(--muted-fg)' : '#fff',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled && !active ? 0.6 : 1,
                boxShadow: active ? 'none' : '0 8px 20px color-mix(in srgb, var(--wedding-color) 28%, transparent)',
              }}
            >
              {showSpinner && <Spinner size={15} color={active ? 'var(--muted-fg)' : '#fff'} />}
              {actionLabel(activePlan, active)}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Preenche o selectedVariant inicial (ou as chaves novas que ainda não têm
// seleção, ex.: quando os planos chegam depois via fetch assíncrono) sem
// descartar toggles que o usuário já tenha feito nos grupos existentes.
export function fillPlanVariantSelection(
  plans: PlanCardPlan[],
  initialPlanId: string | null,
  prev: Record<string, string>,
): Record<string, string> {
  const next = { ...prev }
  for (const [groupKey, variants] of groupPlans(plans)) {
    if (next[groupKey]) continue
    const current = variants.find((v) => v.id === initialPlanId)
    // variants nunca é vazio — groupPlans só cria a entrada ao dar push do 1º item.
    next[groupKey] = current?.id ?? variants[0]!.id
  }
  return next
}
