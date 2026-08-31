import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { cancelPreapproval } from '@/lib/integrations/payment/mercadopago'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

// Espelha POST /api/v1/billing/cancel-subscription (casal) pro lado do fornecedor.
// Só faz sentido pra 'monthly' — 'lifetime' foi pago uma vez só e nunca tem nada pra
// cancelar no Mercado Pago (nunca decisão de UI mostrar "cancelar renovação" pra
// vitalício, ver src/components/vendors/dashboard/vendor-subscription-manager.tsx).
export async function POST() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const vendor = await requireVendorProfile(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `vendor-cancel-subscription:${vendor.id}`, 10, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const { data: subscription, error: subError } = await supabase
      .from('vendor_subscriptions')
      .select('id, plan_id, gateway, gateway_sub_id, current_period_end, vendor_plans!inner(billing_type)')
      .eq('vendor_id', vendor.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError) return err(500, 'DB_ERROR', 'Erro ao buscar assinatura.')
    if (!subscription) return err(404, 'SUBSCRIPTION_NOT_FOUND', 'Nenhuma assinatura ativa encontrada.')

    const billingType = (subscription.vendor_plans as unknown as { billing_type: string } | null)?.billing_type
    if (billingType !== 'monthly') {
      return err(400, 'NOT_RECURRING', 'Este plano não é uma assinatura recorrente — não há nada para cancelar.')
    }
    if (subscription.gateway !== 'mercadopago' || !subscription.gateway_sub_id) {
      return err(400, 'NOT_CANCELLABLE', 'Esta assinatura não foi contratada pelo Mercado Pago e não pode ser cancelada por aqui.')
    }

    try {
      await cancelPreapproval(subscription.gateway_sub_id)
    } catch (mpError) {
      console.error('[vendor/billing/cancel-subscription] erro ao cancelar no Mercado Pago:', mpError)
      return err(502, 'PAYMENT_GATEWAY_ERROR', 'Não foi possível cancelar a assinatura agora. Tente novamente.')
    }

    // Não apaga histórico — só marca o cancelamento. Se current_period_end é
    // conhecido e ainda não passou, o acesso pago continua válido até lá
    // (cancel_at_period_end=true, status continua 'active' — fn_vendor_is_publicly_
    // visible só olha status+expires_at, então o fornecedor segue visível até o fim
    // do período já pago). PENDÊNCIA CONHECIDA: nem o webhook do casal nem o de
    // fornecedor populam current_period_end hoje (o Mercado Pago não devolve isso de
    // graça na resposta de preapproval usada aqui) — na prática esta coluna está
    // sempre NULL, então o ramo abaixo sempre cai no cancelamento imediato (mesmo
    // comportamento já usado do lado do casal). Fica pronto pra virar um cancelamento
    // com carência de verdade assim que current_period_end passar a ser populado.
    const nowIso = new Date().toISOString()
    const hasKnownRemainingPeriod = Boolean(subscription.current_period_end && subscription.current_period_end > nowIso)

    const { error: updateError } = await supabase
      .from('vendor_subscriptions')
      .update(
        hasKnownRemainingPeriod
          ? { cancel_at_period_end: true }
          : { status: 'canceled', cancel_at_period_end: true },
      )
      .eq('id', subscription.id)

    if (updateError) {
      return err(500, 'DB_ERROR', 'A assinatura foi cancelada no Mercado Pago, mas houve um erro ao atualizar seu status. Contate o suporte.')
    }

    return ok({ cancelled: true, access_until: hasKnownRemainingPeriod ? subscription.current_period_end : null })
  } catch (error) {
    return handleApiError(error)
  }
}
