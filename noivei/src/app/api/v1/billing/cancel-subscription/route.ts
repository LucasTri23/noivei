import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { cancelPreapproval } from '@/lib/integrations/payment/mercadopago'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

// Cancela a assinatura recorrente (Preapproval) ativa do usuário — só faz sentido
// pra planos mensais; um plano de pagamento único não tem nada pra "cancelar" no
// Mercado Pago (já foi pago uma vez, só expira sozinho via subscriptions.expires_at).
export async function POST() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()

    // Cancelar repetidamente não é uma ação de negócio legítima em loop, e cada chamada
    // bem-sucedida chega a fazer uma requisição real de cancelamento no Mercado Pago.
    const limitCheck = await checkRateLimit(supabase, `cancel-subscription:${user.id}`, 10, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, plan_id, gateway, gateway_sub_id, plans!inner(billing_interval)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError) return err(500, 'DB_ERROR', 'Erro ao buscar assinatura.')
    if (!subscription) return err(404, 'SUBSCRIPTION_NOT_FOUND', 'Nenhuma assinatura ativa encontrada.')

    const billingInterval = (subscription.plans as unknown as { billing_interval: string } | null)?.billing_interval
    if (billingInterval !== 'monthly') {
      return err(400, 'NOT_RECURRING', 'Este plano não é uma assinatura recorrente — não há nada para cancelar.')
    }
    if (subscription.gateway !== 'mercadopago' || !subscription.gateway_sub_id) {
      return err(400, 'NOT_CANCELLABLE', 'Esta assinatura não foi contratada pelo Mercado Pago e não pode ser cancelada por aqui.')
    }

    try {
      await cancelPreapproval(subscription.gateway_sub_id)
    } catch (mpError) {
      console.error('[billing/cancel-subscription] erro ao cancelar no Mercado Pago:', mpError)
      return err(502, 'PAYMENT_GATEWAY_ERROR', 'Não foi possível cancelar a assinatura agora. Tente novamente.')
    }

    // status deixa de ser 'active' — fn_resolve_wedding_plan (usado em todo o app pra
    // saber o plano vigente) já trata "sem assinatura active" como Gratuito, então não
    // precisa zerar plan_id aqui: só marcar o cancelamento é suficiente.
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ status: 'canceled', cancel_at_period_end: true })
      .eq('id', subscription.id)

    if (updateError) {
      return err(500, 'DB_ERROR', 'A assinatura foi cancelada no Mercado Pago, mas houve um erro ao atualizar seu status. Contate o suporte.')
    }

    return ok({ cancelled: true })
  } catch (error) {
    return handleApiError(error)
  }
}
