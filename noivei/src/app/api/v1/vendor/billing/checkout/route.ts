import { z } from 'zod'

import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { createOneTimeCheckout, createSubscriptionCheckout } from '@/lib/integrations/payment/mercadopago'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

const CheckoutSchema = z.object({ vendor_plan_id: z.string().trim().min(1) })

// Fase 5 (billing do fornecedor) — espelha POST /api/v1/billing/checkout (casal),
// mas 100% isolado: lê vendor_plans (nunca plans), grava vendor_payment_checkouts
// (nunca payment_checkouts), e usa /api/v1/webhooks/mercadopago-vendor como
// notification_url (webhook próprio, ver arquivo daquela rota) — nunca mistura as
// duas cadeias de cobrança, decisão de arquitetura já aprovada (ver comentário no
// topo de 20260806000003_create-vendor-marketplace-billing.sql).
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const vendor = await requireVendorProfile(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `vendor-billing-checkout:${vendor.id}`, 15, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const body = await parseJsonBody(req)
    const parsed = CheckoutSchema.safeParse(body)
    if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Informe o plano.', parsed.error.flatten())

    // Nunca confia em preço/plano vindo do client — busca direto do banco, a mesma
    // fonte que a tela de assinatura do fornecedor usa pra exibir.
    const { data: plan, error: planError } = await supabase
      .from('vendor_plans')
      .select('id, name, price_cents, billing_type, active')
      .eq('id', parsed.data.vendor_plan_id)
      .eq('active', true)
      .maybeSingle()

    if (planError) return err(500, 'DB_ERROR', 'Erro ao buscar o plano.')
    if (!plan) return err(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.')

    if (plan.billing_type === 'monthly' && !user.email) {
      return err(400, 'EMAIL_REQUIRED', 'Sua conta precisa de um e-mail para assinar um plano recorrente.')
    }

    // Cupom percent/fixed já resgatado (ver POST /api/v1/vendor/coupons/redeem) e
    // ainda não usado em nenhum pagamento — reduz o valor cobrado agora; só é
    // marcado como "gasto" de fato quando o webhook confirmar o pagamento.
    const { data: pendingDiscount } = (await supabase
      .rpc('fn_get_pending_vendor_coupon_discount', { p_vendor_id: vendor.id, p_vendor_plan_id: plan.id })
      .maybeSingle()) as { data: { redemption_id: string; discount_type: string; discount_value: number } | null }

    let amountCents = plan.price_cents
    if (pendingDiscount) {
      amountCents = pendingDiscount.discount_type === 'percent'
        ? Math.round(plan.price_cents * (1 - pendingDiscount.discount_value / 100))
        : plan.price_cents - pendingDiscount.discount_value
      // Mercado Pago não aceita valor zero/negativo.
      amountCents = Math.max(1, amountCents)
    }
    const discountCents = plan.price_cents - amountCents

    const mpReference = crypto.randomUUID()

    const { data: checkout, error: checkoutError } = await supabase
      .from('vendor_payment_checkouts')
      .insert({
        vendor_id:            vendor.id,
        vendor_plan_id:       plan.id,
        mp_reference:         mpReference,
        coupon_redemption_id: pendingDiscount?.redemption_id ?? null,
        amount_cents:         amountCents,
        discount_cents:       discountCents,
      })
      .select('id')
      .single()

    if (checkoutError || !checkout) return err(500, 'DB_ERROR', 'Erro ao iniciar o checkout.')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const notificationUrl = `${appUrl}/api/v1/webhooks/mercadopago-vendor`
    const amountBrl = amountCents / 100

    try {
      const result = plan.billing_type === 'monthly'
        ? await createSubscriptionCheckout({
            reason:             `Wednest Fornecedores — ${plan.name}`,
            payerEmail:         user.email!,
            amountBrl,
            externalReference:  mpReference,
            backUrl:            `${appUrl}/fornecedor/assinatura?checkout=retorno`,
            notificationUrl,
          })
        : await createOneTimeCheckout({
            itemTitle:          `Wednest Fornecedores — ${plan.name}`,
            amountBrl,
            externalReference:  mpReference,
            successUrl:         `${appUrl}/fornecedor/assinatura?checkout=sucesso`,
            failureUrl:         `${appUrl}/fornecedor/assinatura?checkout=falha`,
            pendingUrl:         `${appUrl}/fornecedor/assinatura?checkout=pendente`,
            notificationUrl,
          })

      await supabase
        .from('vendor_payment_checkouts')
        .update(
          plan.billing_type === 'monthly'
            ? { mp_preapproval_id: result.id }
            : { mp_preference_id: result.id },
        )
        .eq('id', checkout.id)

      return ok({ redirect_url: result.redirectUrl })
    } catch (mpError) {
      console.error('[vendor/billing/checkout] erro ao criar checkout no Mercado Pago:', mpError)
      await supabase.from('vendor_payment_checkouts').update({ status: 'rejected' }).eq('id', checkout.id)
      return err(502, 'PAYMENT_GATEWAY_ERROR', 'Não foi possível iniciar o pagamento. Tente novamente.')
    }
  } catch (error) {
    return handleApiError(error)
  }
}
