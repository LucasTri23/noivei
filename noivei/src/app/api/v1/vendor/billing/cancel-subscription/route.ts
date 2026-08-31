import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { cancelPreapproval, fetchPreapproval } from '@/lib/integrations/payment/mercadopago'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

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

    // Rebusca o preapproval ANTES de cancelar — next_payment_date é a data do
    // próximo débito que o cancelamento vai impedir, ou seja, exatamente até quando
    // o período JÁ PAGO continua valendo. Precisa ser ANTES do cancelPreapproval
    // abaixo porque o Mercado Pago pode limpar esse campo assim que a assinatura
    // vira 'cancelled'. Nunca confia no current_period_end já salvo no banco (pode
    // estar desatualizado ou nunca ter sido populado) — sempre a fonte viva.
    let nextPaymentDate: string | null = null
    try {
      const freshPreapproval = await fetchPreapproval(subscription.gateway_sub_id)
      nextPaymentDate = freshPreapproval.next_payment_date ?? null
    } catch (fetchError) {
      // Não bloqueia o cancelamento por causa disso — só significa que o acesso
      // vai encerrar imediatamente (ramo abaixo), nunca uma data inventada.
      console.error('[vendor/billing/cancel-subscription] falha ao rebuscar next_payment_date antes de cancelar:', fetchError)
    }

    try {
      await cancelPreapproval(subscription.gateway_sub_id)
    } catch (mpError) {
      console.error('[vendor/billing/cancel-subscription] erro ao cancelar no Mercado Pago:', mpError)
      return err(502, 'PAYMENT_GATEWAY_ERROR', 'Não foi possível cancelar a assinatura agora. Tente novamente.')
    }

    // Não apaga histórico — só marca o cancelamento.
    //
    // Com período pago conhecido (nextPaymentDate no futuro): impede renovação
    // futura (cancelPreapproval acima já fez isso no Mercado Pago) mas MANTÉM o
    // entitlement até o fim do período — status continua 'active',
    // cancel_at_period_end=true, e expires_at é setado pra essa mesma data.
    // fn_vendor_is_publicly_visible (20260806000003) já checa
    // "expires_at IS NULL OR expires_at > NOW()" pra decidir visibilidade pública —
    // reaproveitar essa checagem existente é o que torna a assinatura
    // "efetivamente inativa" depois do período sem precisar de nenhum cron novo
    // varrendo assinaturas expiradas.
    //
    // Sem período conhecido (Mercado Pago não devolveu next_payment_date):
    // cancelamento imediato — nunca inventa uma data de carência que não temos
    // como confirmar.
    const nowIso = new Date().toISOString()
    const hasKnownRemainingPeriod = Boolean(nextPaymentDate && nextPaymentDate > nowIso)

    // Service role, não o client autenticado normal: vendor_subscriptions não tem
    // NENHUMA policy de UPDATE pra `authenticated` de propósito (ver comentário em
    // 20260806000003 — "TODA escrita aqui é service role ou fn_redeem_vendor_coupon,
    // nunca o client direto", mesma lição SEC-01 do lado do casal). Com o client
    // normal, este UPDATE simplesmente afetaria 0 linhas sem erro nenhum — bug real,
    // encontrado revisando cada escrita em vendor_subscriptions antes de fechar a
    // Fase 5, não pego pelos testes de unidade (mock não simula RLS de verdade).
    const { error: updateError } = await createSupabaseService()
      .from('vendor_subscriptions')
      .update(
        hasKnownRemainingPeriod
          ? { cancel_at_period_end: true, current_period_end: nextPaymentDate, expires_at: nextPaymentDate }
          : { status: 'canceled', cancel_at_period_end: true },
      )
      .eq('id', subscription.id)

    if (updateError) {
      return err(500, 'DB_ERROR', 'A assinatura foi cancelada no Mercado Pago, mas houve um erro ao atualizar seu status. Contate o suporte.')
    }

    return ok({ cancelled: true, access_until: hasKnownRemainingPeriod ? nextPaymentDate : null })
  } catch (error) {
    return handleApiError(error)
  }
}
