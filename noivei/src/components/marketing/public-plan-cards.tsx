'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PlanCardsGrid, { fillPlanVariantSelection, type PlanCardPlan } from '@/components/billing/plan-cards-grid'
import type { PlanFeature, PlanFeatureCategory, PlanFeatureValue } from '@/types/database'

export interface PublicPlanCardsProps {
  plans:      PlanCardPlan[]
  categories: PlanFeatureCategory[]
  features:   PlanFeature[]
  values:     PlanFeatureValue[]
}

// Rótulo do botão por preço/posição (nunca por nome do plano — o catálogo é
// dinâmico): Gratuito é sempre R$0; `highlight` hoje marca o Premium (o plano
// do meio, o mais escolhido); o card restante é o mais caro (Exclusivo).
function actionLabelFor(plan: PlanCardPlan): string {
  if (plan.price_brl === 0) return 'Começar gratuitamente'
  if (plan.highlight) return 'Quero organizar meu casamento'
  return 'Quero a experiência completa'
}

/**
 * Vitrine pública de planos (visitante deslogado, sem sessão) — mostra os
 * mesmos cards de /perfil/planos, mas sem nenhuma lógica de troca de plano ou
 * pagamento: assinar de verdade só é possível com conta, então toda ação leva
 * ao cadastro.
 */
export default function PublicPlanCards({ plans, categories, features, values }: PublicPlanCardsProps) {
  const router = useRouter()
  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>(() =>
    fillPlanVariantSelection(plans, null, {}),
  )

  return (
    <PlanCardsGrid
      plans={plans}
      categories={categories}
      features={features}
      values={values}
      selectedVariant={selectedVariant}
      onToggleVariant={(groupKey, variantId) => setSelectedVariant((prev) => ({ ...prev, [groupKey]: variantId }))}
      isActive={() => false}
      actionDisabled={() => false}
      actionLabel={(plan) => actionLabelFor(plan)}
      onAction={() => router.push('/signup')}
    />
  )
}
