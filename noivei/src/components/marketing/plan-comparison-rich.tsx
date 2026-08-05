import { Fragment } from 'react'
import { groupPlans } from '@/lib/billing/plan-groups'
import type { PlanFeature, PlanFeatureCategory, PlanFeatureValue } from '@/types/database'
import type { PlanCardPlan } from '@/components/billing/plan-cards-grid'

export interface PlanComparisonRichProps {
  plans:      PlanCardPlan[]
  categories: PlanFeatureCategory[]
  features:   PlanFeature[]
  values:     PlanFeatureValue[]
}

// Explicação curta de benefício por recurso — casada pelo texto do `feature.label`
// (fallback silencioso: se o texto no banco mudar e nada bater, a linha só não
// ganha explicação, sem quebrar). Fatos reais do produto, sem inventar recurso.
const FEATURE_EXPLANATIONS: { match: (label: string) => boolean; text: string }[] = [
  {
    match: (label) => label.toLowerCase().includes('checklist'),
    text: 'Tarefas geradas sob medida a partir das respostas sobre o seu casamento (data, orçamento, estilo, convidados) — não é uma lista genérica.',
  },
  {
    match: (label) => label.toLowerCase().includes('financeiro'),
    text: 'Controle de gastos, parcelas e cotação de fornecedores num só lugar, com meta de orçamento por categoria.',
  },
  {
    match: (label) => label.toLowerCase().includes('site do casal') || label.toLowerCase().includes('site '),
    text: 'Site personalizado com história do casal, cerimônia, lista de presentes e confirmação de presença.',
  },
  {
    match: (label) => label.toLowerCase().includes('álbum') || label.toLowerCase().includes('album'),
    text: 'Convidados enviam fotos direto do celular durante a festa, escaneando um QR code — sem criar conta.',
  },
  {
    match: (label) => label.toLowerCase().includes('check-in') || label.toLowerCase().includes('checkin') || label.toLowerCase().includes('portaria'),
    text: 'Valida a entrada de cada convidado no dia do evento escaneando o QR do ingresso individual, em tempo real.',
  },
]

function explanationFor(label: string): string | null {
  return FEATURE_EXPLANATIONS.find((entry) => entry.match(label))?.text ?? null
}

function formatBrl(cents: number | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function cellContent(rawValue: string | undefined): { included: boolean; text: string | null } {
  if (rawValue == null || rawValue === '❌') return { included: false, text: null }
  if (rawValue === '✅') return { included: true, text: null }
  return { included: true, text: rawValue.replace(/^✅\s*/, '') }
}

/**
 * Comparação linha-a-linha entre planos, com explicação de benefício (não só
 * ✓/✕) — reutilizável em qualquer tela que já tenha o catálogo carregado do
 * banco (página pública de planos, /perfil/planos). Não faz fetch nem assume
 * contexto de página específica.
 */
export default function PlanComparisonRich({ plans, categories, features, values }: PlanComparisonRichProps) {
  const groupedPlans = groupPlans(plans)
  const columns = Array.from(groupedPlans.entries()).map(([groupKey, variants]) => ({
    groupKey,
    // variants nunca é vazio — groupPlans só cria a entrada ao dar push do 1º item.
    plan: variants[0]!,
    hasVariants: variants.length > 1,
  }))

  const valueByFeatureAndGroup = new Map(values.map((v) => [`${v.feature_id}:${v.group_key}`, v.value]))
  const featuresByCategory = new Map<string, PlanFeature[]>()
  features.forEach((feature) => {
    const list = featuresByCategory.get(feature.category_id) ?? []
    list.push(feature)
    featuresByCategory.set(feature.category_id, list)
  })

  return (
    <section
      className="mx-auto"
      style={{ maxWidth: '1240px', padding: 'clamp(40px, 6vw, 80px) clamp(20px, 4vw, 44px)' }}
    >
      <div className="mx-auto text-center" style={{ maxWidth: '640px', marginBottom: 'clamp(32px, 4vw, 48px)' }}>
        <h2
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(26px, 3.4vw, 38px)', lineHeight: 1.14, color: 'var(--fg)', margin: '0 0 10px' }}
        >
          Compare cada recurso em detalhe.
        </h2>
        <p style={{ fontSize: '15px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: 0 }}>
          Não é só uma lista de marcados — veja o que cada recurso realmente faz por vocês.
        </p>
      </div>

      <div
        className="rounded-2xl"
        style={{
          background: 'var(--surface)',
          boxShadow: '0 8px 22px rgba(60,40,24,0.06)',
          border: '1px solid color-mix(in srgb, var(--wedding-color) 10%, transparent)',
          overflowX: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${280 + columns.length * 160}px` }}>
          <thead>
            <tr>
              <th
                scope="col"
                style={{
                  textAlign: 'left', padding: 'clamp(16px, 2vw, 22px)', minWidth: '260px',
                  borderBottom: '1.5px solid color-mix(in srgb, var(--wedding-color) 14%, transparent)',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-fg)' }}>
                  Recursos
                </span>
              </th>
              {columns.map(({ groupKey, plan, hasVariants }) => (
                <th
                  key={groupKey}
                  scope="col"
                  style={{
                    textAlign: 'left', padding: 'clamp(16px, 2vw, 22px)', minWidth: '150px',
                    borderBottom: plan.highlight
                      ? '1.5px solid var(--wedding-color)'
                      : '1.5px solid color-mix(in srgb, var(--wedding-color) 14%, transparent)',
                    background: plan.highlight ? 'var(--wedding-color-subtle)' : 'transparent',
                  }}
                >
                  <div className="font-display" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--fg)' }}>
                    {plan.emoji} {plan.name}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '2px' }}>
                    {hasVariants ? 'a partir de ' : ''}{formatBrl(plan.price_brl)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const rows = featuresByCategory.get(category.id) ?? []
              if (rows.length === 0) return null
              return (
                <Fragment key={category.id}>
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      style={{
                        padding: '18px clamp(16px, 2vw, 22px) 8px',
                        fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--wedding-color-dark)',
                      }}
                    >
                      {category.title}
                    </td>
                  </tr>
                  {rows.map((feature) => {
                    const explanation = explanationFor(feature.label)
                    return (
                      <tr key={feature.id}>
                        <th
                          scope="row"
                          style={{
                            textAlign: 'left', fontWeight: 500, padding: 'clamp(10px, 1.4vw, 14px) clamp(16px, 2vw, 22px)',
                            borderBottom: '1px solid color-mix(in srgb, var(--wedding-color) 8%, transparent)',
                            verticalAlign: 'top',
                          }}
                        >
                          <div style={{ fontSize: '14px', color: 'var(--fg)' }}>{feature.label}</div>
                          {explanation && (
                            <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '3px', lineHeight: 1.5, maxWidth: '320px' }}>
                              {explanation}
                            </div>
                          )}
                        </th>
                        {columns.map(({ groupKey, plan }) => {
                          const rawValue = valueByFeatureAndGroup.get(`${feature.id}:${groupKey}`)
                          const { included, text } = cellContent(rawValue)
                          return (
                            <td
                              key={groupKey}
                              style={{
                                padding: 'clamp(10px, 1.4vw, 14px) clamp(16px, 2vw, 22px)',
                                borderBottom: '1px solid color-mix(in srgb, var(--wedding-color) 8%, transparent)',
                                background: plan.highlight ? 'color-mix(in srgb, var(--wedding-color) 4%, transparent)' : 'transparent',
                                verticalAlign: 'top',
                              }}
                            >
                              <div className="flex items-center gap-2" style={{ fontSize: '13.5px', color: included ? 'var(--fg)' : 'var(--muted-fg)', opacity: included ? 1 : 0.55 }}>
                                <span style={{ color: included ? 'var(--wedding-color)' : 'var(--muted-fg)', fontWeight: 700, flexShrink: 0 }}>
                                  {included ? '✓' : '✕'}
                                </span>
                                {text && <span>{text}</span>}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
