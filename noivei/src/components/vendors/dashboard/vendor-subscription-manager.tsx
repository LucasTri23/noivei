'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { VendorPlan, VendorSubscription } from '@/types/database'

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })

interface VendorSubscriptionManagerProps {
  plans:        VendorPlan[]
  subscription: VendorSubscription | null
}

const STATUS_LABEL: Record<string, string> = {
  pending:  'Pagamento pendente',
  active:   'Ativa',
  past_due: 'Pagamento atrasado',
  canceled: 'Cancelada',
  expired:  'Expirada',
}

export default function VendorSubscriptionManager({ plans, subscription }: VendorSubscriptionManagerProps) {
  const router = useRouter()
  const [startingCheckout, setStartingCheckout] = useState<string | null>(null)
  const [cancelling, setCancelling]             = useState(false)
  const [couponCode, setCouponCode]             = useState('')
  const [redeeming, setRedeeming]               = useState(false)

  const currentPlan = subscription ? plans.find((p) => p.id === subscription.plan_id) : null
  const isActive = subscription?.status === 'active'
  const isMonthly = currentPlan?.billing_type === 'monthly'
  const canCancel = isActive && isMonthly && !subscription?.cancel_at_period_end

  // Volta do checkout do Mercado Pago com ?checkout=sucesso|falha|pendente|retorno —
  // a ativação de verdade só acontece pelo webhook isolado de fornecedor.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    if (!checkout) return

    if (checkout === 'sucesso' || checkout === 'retorno') {
      toastSuccess('Pagamento recebido! Sua assinatura será ativada assim que a confirmação chegar (pode levar alguns instantes).')
    } else if (checkout === 'pendente') {
      toastSuccess('Pagamento pendente de confirmação. Assim que for aprovado, sua assinatura é ativada automaticamente.')
    } else if (checkout === 'falha') {
      toastError('Pagamento não foi concluído. Você pode tentar novamente quando quiser.')
    }

    window.history.replaceState(null, '', window.location.pathname)
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve rodar uma vez, ao montar (lendo a URL de retorno do checkout)
  }, [])

  async function handleCheckout(planId: string) {
    setStartingCheckout(planId)
    const res = await fetch('/api/v1/vendor/billing/checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ vendor_plan_id: planId }),
    })
    const body = (await res.json().catch(() => null)) as { data?: { redirect_url: string }; error?: { message: string } } | null

    if (!res.ok || !body?.data?.redirect_url) {
      setStartingCheckout(null)
      toastError(body?.error?.message ?? 'Não foi possível iniciar o pagamento. Tente novamente.')
      return
    }

    window.location.assign(body.data.redirect_url)
  }

  async function handleCancel() {
    if (!window.confirm('Deseja realmente cancelar sua assinatura mensal? Seu perfil deixa de aparecer no marketplace quando o acesso pago terminar.')) return

    setCancelling(true)
    const res = await fetch('/api/v1/vendor/billing/cancel-subscription', { method: 'POST' })
    const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null
    setCancelling(false)

    const resultBody = body as { data?: { access_until: string | null } } | null

    if (!res.ok) {
      toastError(body?.error?.message ?? 'Não foi possível cancelar a assinatura. Tente novamente.')
      return
    }

    const accessUntil = resultBody?.data?.access_until
    toastSuccess(
      accessUntil
        ? `Assinatura cancelada. Seu acesso continua válido até ${dateFmt.format(new Date(accessUntil))}.`
        : 'Assinatura cancelada. Seu acesso ao marketplace foi encerrado.',
    )
    router.refresh()
  }

  async function handleRedeemCoupon() {
    if (!couponCode.trim()) return
    setRedeeming(true)
    const res = await fetch('/api/v1/vendor/coupons/redeem', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code: couponCode.trim() }),
    })
    const body = (await res.json().catch(() => null)) as { data?: { message: string }; error?: { message: string } } | null
    setRedeeming(false)

    if (!res.ok) {
      toastError(body?.error?.message ?? 'Não foi possível aplicar esse cupom.')
      return
    }
    toastSuccess(body?.data?.message ?? 'Cupom aplicado!')
    setCouponCode('')
    router.refresh()
  }

  return (
    <div>
      {subscription && (
        <div
          style={{
            background: 'var(--surface)', border: '1px solid #EBDDD0', borderRadius: '18px',
            padding: '20px 22px', marginBottom: '22px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Assinatura atual
          </span>
          <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--fg)', margin: '4px 0 2px' }}>
            {currentPlan?.name ?? subscription.plan_id}
          </p>
          <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', margin: 0 }}>
            {STATUS_LABEL[subscription.status] ?? subscription.status}
            {subscription.cancel_at_period_end && subscription.status === 'active' && ' — cancelamento agendado'}
          </p>

          {subscription.current_period_end && subscription.status === 'active' && (
            <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: '6px 0 0' }}>
              {subscription.cancel_at_period_end ? 'Acesso válido até ' : 'Próxima cobrança em '}
              <strong style={{ color: 'var(--fg)' }}>{dateFmt.format(new Date(subscription.current_period_end))}</strong>
            </p>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              style={{
                marginTop: '14px', border: '1.5px solid #C0553F', background: 'transparent', color: '#C0553F',
                borderRadius: '12px', padding: '10px 18px', fontWeight: 700, fontSize: '13.5px',
                cursor: cancelling ? 'not-allowed' : 'pointer', opacity: cancelling ? 0.6 : 1,
              }}
            >
              {cancelling ? 'Cancelando…' : 'Cancelar assinatura'}
            </button>
          )}
        </div>
      )}

      {/* Planos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {plans.map((plan) => {
          const isCurrent = isActive && subscription?.plan_id === plan.id
          return (
            <div
              key={plan.id}
              style={{
                background: 'var(--surface)', border: `1.5px solid ${isCurrent ? 'var(--wedding-color)' : '#EBDDD0'}`,
                borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {plan.billing_type === 'monthly' ? 'Mensal' : 'Vitalício'}
              </span>
              <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--fg)', margin: 0 }}>{plan.name}</p>
              <p style={{ fontSize: '26px', fontWeight: 700, color: 'var(--wedding-color-dark)', margin: 0 }}>
                {currencyFmt.format(plan.price_cents / 100)}
                {plan.billing_type === 'monthly' && <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted-fg)' }}>/mês</span>}
              </p>
              {plan.billing_type === 'lifetime' && (
                <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', margin: 0 }}>Pagamento único, sem renovação.</p>
              )}

              <button
                type="button"
                disabled={isCurrent || startingCheckout !== null}
                onClick={() => handleCheckout(plan.id)}
                style={{
                  marginTop: '8px', border: 'none', borderRadius: '12px', padding: '12px 18px',
                  fontWeight: 700, fontSize: '14px',
                  background: isCurrent ? 'var(--muted)' : 'var(--wedding-color)',
                  color: isCurrent ? 'var(--muted-fg)' : '#fff',
                  cursor: isCurrent || startingCheckout !== null ? 'not-allowed' : 'pointer',
                  opacity: startingCheckout !== null && startingCheckout !== plan.id ? 0.6 : 1,
                }}
              >
                {isCurrent ? 'Plano atual' : startingCheckout === plan.id ? 'Redirecionando…' : 'Contratar'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Cupom */}
      <div
        className="rounded-2xl"
        style={{
          background: 'var(--surface)', border: '1px solid #EBDDD0', borderRadius: '18px', padding: '18px',
          display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label htmlFor="vendor-coupon-code" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)', display: 'block', marginBottom: '6px' }}>
            Tenho um cupom
          </label>
          <input
            id="vendor-coupon-code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="Ex: FORNECEDOR10"
            style={{
              border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '11px 14px',
              fontSize: '14px', color: 'var(--fg)', background: 'var(--bg)', outline: 'none', width: '100%',
            }}
          />
        </div>
        <button
          type="button"
          disabled={redeeming || !couponCode.trim()}
          onClick={handleRedeemCoupon}
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
