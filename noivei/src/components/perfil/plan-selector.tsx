'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'
import PlanCardsGrid, { fillPlanVariantSelection, type PlanCardPlan } from '@/components/billing/plan-cards-grid'
import { computeCouponPreview, type CouponPreviewLine } from '@/lib/billing/coupon-preview'
import type { PlanFeature, PlanFeatureCategory, PlanFeatureValue } from '@/types/database'

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export type Plan = PlanCardPlan

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

export default function PlanSelector({ userId, currentPlanId, subscriptionId, plans, categories, features, values }: PlanSelectorProps) {
  const router = useRouter()

  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>(() =>
    fillPlanVariantSelection(plans, currentPlanId, {}),
  )
  const [switching, setSwitching] = useState<string | null>(null)
  const showSpinner = useDelayedLoading(switching !== null)

  const [couponCode, setCouponCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [couponPreview, setCouponPreview] = useState<CouponPreviewLine[]>([])
  const [cancelling, setCancelling] = useState(false)

  const currentPlan = plans.find((p) => p.id === currentPlanId)
  // Só plano mensal (recorrente de verdade, cobrado até cancelar) tem o que
  // cancelar — pagamento único já foi cobrado uma vez só e expira sozinho.
  const canCancelSubscription = Boolean(currentPlan && currentPlan.billing_interval === 'monthly' && currentPlan.price_brl > 0)

  async function cancelSubscription() {
    if (!window.confirm('Deseja realmente cancelar sua assinatura? Você deixará de ser cobrado, mas perde o acesso aos recursos pagos.')) return

    setCancelling(true)
    const res = await fetch('/api/v1/billing/cancel-subscription', { method: 'POST' })
    const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null
    setCancelling(false)

    if (!res.ok) {
      toastError(body?.error?.message ?? 'Não foi possível cancelar a assinatura. Tente novamente.')
      return
    }

    toastSuccess('Assinatura cancelada. Você voltou para o plano Gratuito.')
    router.refresh()
  }

  // Volta do checkout do Mercado Pago com ?checkout=sucesso|falha|pendente|retorno
  // (ver back_urls/back_url em /api/v1/billing/checkout) — a ativação de verdade do
  // plano só acontece pelo webhook, então mesmo "sucesso" aqui é só "em processamento".
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    if (!checkout) return

    if (checkout === 'sucesso' || checkout === 'retorno') {
      toastSuccess('Pagamento recebido! Seu plano será atualizado assim que a confirmação chegar (pode levar alguns instantes).')
    } else if (checkout === 'pendente') {
      toastSuccess('Pagamento pendente de confirmação. Assim que for aprovado, seu plano é atualizado automaticamente.')
    } else if (checkout === 'falha') {
      toastError('Pagamento não foi concluído. Você pode tentar novamente quando quiser.')
    }

    window.history.replaceState(null, '', window.location.pathname)
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve rodar uma vez, ao montar (lendo a URL de retorno do checkout)
  }, [])

  async function redeemCoupon() {
    if (!couponCode.trim()) return
    setRedeeming(true)
    setCouponPreview([])
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
    if (body?.data) setCouponPreview(computeCouponPreview(plans, body.data))
    setCouponCode('')
    router.refresh()
  }

  async function selectPlan(planId: string) {
    const plan = plans.find((p) => p.id === planId)

    // Plano pago: não grava nada direto — cria o checkout no Mercado Pago e
    // redireciona. A assinatura só vira 'active' de fato quando o webhook confirmar
    // o pagamento (ver /api/v1/webhooks/mercadopago).
    if (plan && plan.price_brl > 0) {
      setSwitching(planId)
      const res = await fetch('/api/v1/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan_id: planId }),
      })
      const resBody = (await res.json().catch(() => null)) as { data?: { redirect_url: string }; error?: { message: string } } | null

      if (!res.ok || !resBody?.data?.redirect_url) {
        setSwitching(null)
        toastError(resBody?.error?.message ?? 'Não foi possível iniciar o pagamento. Tente novamente.')
        return
      }

      window.location.assign(resBody.data.redirect_url)
      return
    }

    // Plano Gratuito: sem pagamento nenhum, grava direto.
    setSwitching(planId)
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
      <div className="mb-8">
        <PlanCardsGrid
          plans={plans}
          categories={categories}
          features={features}
          values={values}
          selectedVariant={selectedVariant}
          onToggleVariant={(groupKey, variantId) => setSelectedVariant((prev) => ({ ...prev, [groupKey]: variantId }))}
          isActive={(plan) => plan.id === currentPlanId}
          actionDisabled={(plan, active) => active || switching !== null}
          actionShowSpinner={(plan) => switching === plan.id && showSpinner}
          actionLabel={(plan, active) =>
            active ? 'Plano atual' : switching === plan.id ? 'Alterando…' : plan.price_brl === 0 ? 'Usar plano Gratuito' : 'Assinar'
          }
          onAction={(plan) => selectPlan(plan.id)}
        />
      </div>

      {/* Cancelar assinatura recorrente */}
      {canCancelSubscription && (
        <div
          className="rounded-2xl p-5 mb-5"
          style={{ background: '#FBEEE6', border: '1px solid #E8C4B8', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', justifyContent: 'space-between' }}
        >
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#C0553F', marginBottom: '2px' }}>
              Assinatura recorrente ativa
            </div>
            <p style={{ fontSize: '13px', color: '#9A6A5A', margin: 0 }}>
              Você é cobrado todo mês pelo plano {currentPlan?.name}. Cancele quando quiser — a cobrança para, mas você perde os recursos pagos.
            </p>
          </div>
          <button
            type="button"
            disabled={cancelling}
            onClick={cancelSubscription}
            style={{
              border: '1.5px solid #C0553F', background: 'transparent', color: '#C0553F',
              borderRadius: '12px', padding: '10px 18px', fontWeight: 700, fontSize: '13.5px',
              cursor: cancelling ? 'not-allowed' : 'pointer', opacity: cancelling ? 0.6 : 1, flexShrink: 0,
            }}
          >
            {cancelling ? 'Cancelando…' : 'Cancelar assinatura'}
          </button>
        </div>
      )}

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

        {couponPreview.length > 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            {couponPreview.map((line) => (
              <div key={line.planId} style={{ fontSize: '13px', color: 'var(--fg)' }}>
                <strong>{line.planLabel}</strong>:{' '}
                <span style={{ textDecoration: 'line-through', color: 'var(--muted-fg)' }}>
                  {currencyFmt.format(line.priceBefore / 100)}
                </span>{' '}
                <span style={{ fontWeight: 700, color: 'var(--wedding-color-dark)' }}>
                  {currencyFmt.format(line.priceAfter / 100)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
