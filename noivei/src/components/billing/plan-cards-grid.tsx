'use client'

import { useState } from 'react'
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

// Card fica com lista de recursos "achatada" (categoria + linhas) sempre que ela
// passa desse total de linhas — só as mais importantes ficam visíveis de cara,
// o resto abre com o botão "+N recursos" (ver PlanCard). Linhas que representam
// uma limitação do plano (não incluído) NUNCA entram nessa contagem de corte —
// elas sempre aparecem, pra nunca esconder algo que o card não oferece atrás de
// um "ver mais".
const FEATURE_COLLAPSE_THRESHOLD = 10
const MIN_VISIBLE_INCLUDED_ROWS  = 5

function formatBrl(cents: number | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function featureLine(label: string, value: string): { text: string; included: boolean } {
  if (value === '❌') return { text: label, included: false }
  if (value === '✅') return { text: label, included: true }
  return { text: `${label}: ${value.replace(/^✅\s*/, '')}`, included: true }
}

// Compara a variante de pagamento único contra a mensal do mesmo grupo (quando
// as duas existem) e devolve uma frase honesta sobre a economia — só usando
// price_brl real das duas, nunca um número inventado. N = quantos meses de
// mensal você precisaria pagar pra igualar ou passar o valor do único (ponto de
// equilíbrio); a partir daí, pagar o único sempre é igual ou mais barato. Some
// dessa comparação um valor em R$ só quando a economia é grande o bastante pra
// valer a pena mostrar (>= R$1 e >= 2%) — caso contrário mostra só a equivalência
// em meses, sem alegar economia insignificante.
function onceSavingsLabel(variants: PlanCardPlan[]): string | null {
  const monthly = variants.find((v) => v.billing_interval === 'monthly' && v.price_brl > 0)
  const once    = variants.find((v) => v.billing_interval === 'once' && v.price_brl > 0)
  if (!monthly || !once) return null

  const months = Math.ceil(once.price_brl / monthly.price_brl)
  if (months < 2) return null

  const equivalentCost = monthly.price_brl * months
  const savingsCents    = equivalentCost - once.price_brl
  const savingsPercent  = savingsCents / equivalentCost

  if (savingsCents >= 100 && savingsPercent >= 0.02) {
    return `Economize ${formatBrl(savingsCents)} vs. ${months} meses no mensal`
  }
  return `Equivale a ${months} meses do plano mensal`
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function DashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c.7 3.9 1.9 5.9 6 6.6-4.1.7-5.3 2.7-6 6.6-.7-3.9-1.9-5.9-6-6.6 4.1-.7 5.3-2.7 6-6.6Z" />
      <path d="M19 15.5c.35 1.9.9 2.9 2.8 3.2-1.9.3-2.45 1.3-2.8 3.2-.35-1.9-.9-2.9-2.8-3.2 1.9-.3 2.45-1.3 2.8-3.2Z" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform var(--duration-base) var(--ease-default)', transform: expanded ? 'rotate(180deg)' : 'none' }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

interface FeatureRow {
  id:       string
  text:     string
  included: boolean
}

interface FeatureSection {
  id:    string
  title: string
  rows:  FeatureRow[]
}

interface PlanCardProps {
  groupKey:               string
  variants:               PlanCardPlan[]
  categories:             PlanFeatureCategory[]
  featuresByCategory:     Map<string, PlanFeature[]>
  valueByFeatureAndGroup: Map<string, string>
  selectedVariant:        Record<string, string>
  onToggleVariant:        (groupKey: string, variantId: string) => void
  isActive:               (plan: PlanCardPlan) => boolean
  actionLabel:            (plan: PlanCardPlan, active: boolean) => string
  actionDisabled:         (plan: PlanCardPlan, active: boolean) => boolean
  actionShowSpinner?:     (plan: PlanCardPlan) => boolean
  onAction:               (plan: PlanCardPlan) => void
}

function PlanCard({
  groupKey, variants, categories, featuresByCategory, valueByFeatureAndGroup,
  selectedVariant, onToggleVariant,
  isActive, actionLabel, actionDisabled, actionShowSpinner, onAction,
}: PlanCardProps) {
  const [expanded, setExpanded] = useState(false)

  // variants nunca é vazio — groupPlans só cria a entrada ao dar push do 1º item.
  const firstVariant = variants[0]!
  const activeId = selectedVariant[groupKey] ?? firstVariant.id
  const activePlan = variants.find((v) => v.id === activeId) ?? firstVariant
  const active = isActive(activePlan)
  const disabled = actionDisabled(activePlan, active)
  const showSpinner = actionShowSpinner?.(activePlan) ?? false
  const highlight = activePlan.highlight

  const sections: FeatureSection[] = categories
    .map((category) => {
      const rows: FeatureRow[] = (featuresByCategory.get(category.id) ?? []).map((feature) => {
        const rawValue = valueByFeatureAndGroup.get(`${feature.id}:${groupKey}`) ?? '❌'
        const { text, included } = featureLine(feature.label, rawValue)
        return { id: feature.id, text, included }
      })
      return { id: category.id, title: category.title, rows }
    })
    .filter((section) => section.rows.length > 0)

  const totalRows    = sections.reduce((sum, s) => sum + s.rows.length, 0)
  const excludedRows = sections.reduce((sum, s) => sum + s.rows.filter((r) => !r.included).length, 0)
  const collapsible  = totalRows > FEATURE_COLLAPSE_THRESHOLD
  const includedBudget = !expanded && collapsible
    ? Math.max(MIN_VISIBLE_INCLUDED_ROWS, FEATURE_COLLAPSE_THRESHOLD - excludedRows)
    : Infinity

  // Corte de visibilidade calculado de forma puramente funcional (sem reatribuir
  // variáveis capturadas) — "achata" seção+linha, decide o que cabe no orçamento
  // de linhas "incluído" via reduce imutável, e depois reagrupa por seção pra
  // renderizar. Linhas de limitação (não incluído) nunca entram nesse corte.
  const flatRows = sections.flatMap((section) =>
    section.rows.map((row) => ({ sectionId: section.id, row })),
  )
  const { visible: visibleFlatRows, hidden: hiddenCount } = flatRows.reduce<{
    visible: { sectionId: string; row: FeatureRow }[]
    shown:   number
    hidden:  number
  }>(
    (acc, item) => {
      if (!item.row.included) return { visible: [...acc.visible, item], shown: acc.shown, hidden: acc.hidden }
      if (acc.shown < includedBudget) return { visible: [...acc.visible, item], shown: acc.shown + 1, hidden: acc.hidden }
      return { visible: acc.visible, shown: acc.shown, hidden: acc.hidden + 1 }
    },
    { visible: [], shown: 0, hidden: 0 },
  )
  const visibleSections = sections
    .map((section) => ({
      ...section,
      rows: visibleFlatRows.filter((item) => item.sectionId === section.id).map((item) => item.row),
    }))
    .filter((section) => section.rows.length > 0)

  const savings = variants.length > 1 && activePlan.billing_interval === 'once'
    ? onceSavingsLabel(variants)
    : null

  return (
    <div className="group relative h-full">
      {highlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-3 rounded-[calc(var(--radius-xl)+0.75rem)] opacity-40 blur-2xl transition-opacity duration-300 group-hover:opacity-60"
          style={{ background: 'linear-gradient(135deg, var(--wedding-color-light), var(--wedding-color-dark))' }}
        />
      )}

      {highlight && (
        <div className="pointer-events-none absolute -top-4 left-1/2 z-10 -translate-x-1/2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-bold whitespace-nowrap text-white uppercase"
            style={{
              letterSpacing: '0.08em',
              background: 'linear-gradient(135deg, var(--wedding-color-light), var(--wedding-color) 60%, var(--wedding-color-dark))',
              boxShadow: '0 8px 18px color-mix(in srgb, var(--wedding-color) 45%, transparent), var(--shadow-sm)',
            }}
          >
            <SparkleIcon />
            MAIS ESCOLHIDO
          </span>
        </div>
      )}

      <div
        className={
          highlight
            ? 'relative flex h-full scale-[1.015] flex-col rounded-[var(--radius-xl)] bg-[var(--surface)] p-7 ring-1 ring-[var(--wedding-color)] transition-transform duration-300 ease-out sm:p-8 group-hover:-translate-y-1.5 group-hover:scale-[1.025]'
            : 'relative flex h-full flex-col rounded-[var(--radius-xl)] bg-[var(--surface)] p-7 ring-1 ring-[var(--border)] transition-transform duration-300 ease-out sm:p-8 group-hover:-translate-y-1'
        }
        style={{
          boxShadow: highlight
            ? 'var(--shadow-md), var(--shadow-xl), 0 0 0 1px color-mix(in srgb, var(--wedding-color) 14%, transparent)'
            : 'var(--shadow), var(--shadow-lg)',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 700, color: highlight ? 'var(--wedding-color-dark)' : 'var(--muted-fg)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
          {activePlan.emoji} {activePlan.name}
        </div>

        <div style={{ marginBottom: '14px' }}>
          {variants.length > 1 && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {variants.map((variant) => {
                const variantActive = variant.id === activeId
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => onToggleVariant(groupKey, variant.id)}
                    style={{
                      flex: 1, padding: '7px 8px', borderRadius: 'var(--radius-md)', fontSize: '12px', minWidth: '90px',
                      border: `1.5px solid ${variantActive ? 'var(--wedding-color)' : 'var(--border)'}`,
                      background: variantActive ? 'var(--wedding-color-subtle)' : 'transparent',
                      color: variantActive ? 'var(--wedding-color-dark)' : 'var(--muted-fg)',
                      fontWeight: variantActive ? 700 : 500, cursor: 'pointer',
                      transition: 'border-color var(--duration-base) var(--ease-default), background var(--duration-base) var(--ease-default), color var(--duration-base) var(--ease-default)',
                    }}
                  >
                    {variant.billing_label ?? variant.name}
                  </button>
                )
              })}
            </div>
          )}
          <span className="font-display" style={{ fontSize: '34px', fontWeight: 600, color: 'var(--fg)' }}>
            {formatBrl(activePlan.price_brl)}
            {activePlan.billing_note?.startsWith('/') && (
              <span style={{ fontSize: '15px', color: 'var(--muted-fg)', fontFamily: 'var(--font-body)' }}>{activePlan.billing_note}</span>
            )}
          </span>
          {activePlan.billing_note && !activePlan.billing_note.startsWith('/') && (
            <div style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>{activePlan.billing_note}</div>
          )}
          {savings && (
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '8px',
                fontSize: '11.5px', fontWeight: 700, color: 'var(--color-success)',
                background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                borderRadius: 'var(--radius-full)', padding: '4px 10px',
              }}
            >
              {savings}
            </div>
          )}
        </div>

        <p style={{ fontSize: '13px', color: 'var(--muted-fg)', lineHeight: 1.5, margin: '0 0 16px' }}>
          {activePlan.description}
        </p>

        <div style={{ borderTop: '1px solid var(--border)', marginBottom: '18px' }} />

        <div style={{ flex: 1, marginBottom: '20px' }}>
          {visibleSections.map((section) => (
            <div key={section.id} style={{ marginBottom: '16px' }}>
              <div style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--muted-fg)', marginBottom: '9px',
              }}>
                {section.title}
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {section.rows.map((row) => (
                  <li
                    key={row.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '9px', fontSize: '13px',
                      color: row.included ? 'var(--fg)' : 'var(--muted-fg)',
                      fontWeight: row.included ? 500 : 400,
                      opacity: row.included ? 1 : 0.65,
                    }}
                  >
                    <span
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '18px', height: '18px', borderRadius: 'var(--radius-full)', flexShrink: 0, marginTop: '1px',
                        color: row.included ? 'var(--wedding-color-dark)' : 'var(--muted-fg)',
                        background: row.included ? 'color-mix(in srgb, var(--wedding-color) 16%, transparent)' : 'var(--muted)',
                      }}
                    >
                      {row.included ? <CheckIcon /> : <DashIcon />}
                    </span>
                    <span style={{ paddingTop: '1px' }}>{row.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {collapsible && (expanded || hiddenCount > 0) && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '4px',
                fontSize: '12.5px', fontWeight: 700, color: 'var(--wedding-color-dark)',
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              }}
            >
              {expanded ? 'Mostrar menos' : `+${hiddenCount} recursos`}
              <ChevronIcon expanded={expanded} />
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction(activePlan)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
            width: '100%', border: 'none', borderRadius: 'var(--radius-lg)', padding: '13px',
            fontWeight: 700, fontSize: '14px',
            background: active ? 'var(--muted)' : 'var(--wedding-color)',
            color: active ? 'var(--muted-fg)' : '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled && !active ? 0.6 : 1,
            boxShadow: active ? 'none' : '0 10px 22px -6px color-mix(in srgb, var(--wedding-color) 40%, transparent), var(--shadow-sm)',
          }}
        >
          {showSpinner && <Spinner size={15} color={active ? 'var(--muted-fg)' : '#fff'} />}
          {actionLabel(activePlan, active)}
        </button>
      </div>
    </div>
  )
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
    <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(270px,1fr))', paddingTop: '18px' }}>
      {Array.from(groupedPlans.entries()).map(([groupKey, variants]) => (
        <PlanCard
          key={groupKey}
          groupKey={groupKey}
          variants={variants}
          categories={categories}
          featuresByCategory={featuresByCategory}
          valueByFeatureAndGroup={valueByFeatureAndGroup}
          selectedVariant={selectedVariant}
          onToggleVariant={onToggleVariant}
          isActive={isActive}
          actionLabel={actionLabel}
          actionDisabled={actionDisabled}
          actionShowSpinner={actionShowSpinner}
          onAction={onAction}
        />
      ))}
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
