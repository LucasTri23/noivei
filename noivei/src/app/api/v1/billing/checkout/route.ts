import { z } from 'zod'

import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { createOneTimeCheckout, createSubscriptionCheckout } from '@/lib/integrations/payment/mercadopago'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

const CheckoutSchema = z.object({ plan_id: z.string().trim().min(1) })

// Cria um checkout no Mercado Pago (Preferência ou Preapproval, dependendo do
// billing_interval do plano) e devolve a URL de redirecionamento. A ativação de
// verdade do plano só acontece depois, via webhook (POST /api/v1/webhooks/mercadopago)
// — esta rota nunca marca a assinatura como ativa diretamente.
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()

    // Iniciar checkout repetidamente não é um risco de segurança em si, mas cada
    // chamada cria um recurso de verdade no Mercado Pago — um limite modesto evita
    // abuso/spam contra a conta do Mercado Pago do próprio Wednest.
    const limitCheck = await checkRateLimit(supabase, `billing-checkout:${user.id}`, 15, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const body = await parseJsonBody(req)
    const parsed = CheckoutSchema.safeParse(body)
    if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Informe o plano.', parsed.error.flatten())

    // Nunca confia em preço/plano vindo do client — busca direto do banco, a mesma
    // fonte que a tela de planos usa pra exibir.
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, name, price_brl, billing_interval, is_active')
      .eq('id', parsed.data.plan_id)
      .eq('is_active', true)
      .maybeSingle()

    if (planError) return err(500, 'DB_ERROR', 'Erro ao buscar o plano.')
    if (!plan) return err(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.')
    if (plan.price_brl === 0) return err(400, 'PLAN_IS_FREE', 'Este plano não precisa de pagamento.')

    if (plan.billing_interval === 'monthly' && !user.email) {
      return err(400, 'EMAIL_REQUIRED', 'Sua conta precisa de um e-mail para assinar um plano recorrente.')
    }

    const mpReference = crypto.randomUUID()

    const { data: checkout, error: checkoutError } = await supabase
      .from('payment_checkouts')
      .insert({ user_id: user.id, plan_id: plan.id, mp_reference: mpReference })
      .select('id')
      .single()

    if (checkoutError || !checkout) return err(500, 'DB_ERROR', 'Erro ao iniciar o checkout.')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const notificationUrl = `${appUrl}/api/v1/webhooks/mercadopago`
    const amountBrl = plan.price_brl / 100

    try {
      const result = plan.billing_interval === 'monthly'
        ? await createSubscriptionCheckout({
            reason:             `Wednest — ${plan.name}`,
            payerEmail:         user.email!,
            amountBrl,
            externalReference:  mpReference,
            backUrl:            `${appUrl}/perfil/planos?checkout=retorno`,
            notificationUrl,
          })
        : await createOneTimeCheckout({
            itemTitle:          `Wednest — ${plan.name}`,
            amountBrl,
            externalReference:  mpReference,
            successUrl:         `${appUrl}/perfil/planos?checkout=sucesso`,
            failureUrl:         `${appUrl}/perfil/planos?checkout=falha`,
            pendingUrl:         `${appUrl}/perfil/planos?checkout=pendente`,
            notificationUrl,
          })

      await supabase
        .from('payment_checkouts')
        .update(
          plan.billing_interval === 'monthly'
            ? { mp_preapproval_id: result.id }
            : { mp_preference_id: result.id },
        )
        .eq('id', checkout.id)

      return ok({ redirect_url: result.redirectUrl })
    } catch (mpError) {
      console.error('[billing/checkout] erro ao criar checkout no Mercado Pago:', mpError)
      await supabase.from('payment_checkouts').update({ status: 'rejected' }).eq('id', checkout.id)
      return err(502, 'PAYMENT_GATEWAY_ERROR', 'Não foi possível iniciar o pagamento. Tente novamente.')
    }
  } catch (error) {
    return handleApiError(error)
  }
}
