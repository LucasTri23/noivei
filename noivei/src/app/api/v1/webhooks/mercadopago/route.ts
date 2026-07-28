import { ok, err, handleApiError } from '@/lib/api/response'
import { fetchPayment, fetchPreapproval, verifyWebhookSignature } from '@/lib/integrations/payment/mercadopago'
import { createSupabaseService } from '@/lib/supabase/service'

interface MpWebhookBody {
  type?:  string
  topic?: string
  id?:    number | string
  data?:  { id?: string }
}

// Rota pública — o Mercado Pago chama isso sem nenhuma sessão de usuário nossa. A
// autenticidade vem só da assinatura (x-signature), nunca de cookie/token de app.
// O formato da notificação varia (query string vs corpo, "type"/"topic", "data.id"/
// "id") dependendo de como o webhook foi configurado no painel do Mercado Pago —
// checamos os dois lugares pra não depender de qual exatamente está em uso.
export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const bodyJson = (await req.json().catch(() => null)) as MpWebhookBody | null

    const dataId =
      url.searchParams.get('data.id') ??
      url.searchParams.get('id') ??
      bodyJson?.data?.id ??
      (bodyJson?.id !== undefined ? String(bodyJson.id) : null)
    const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? bodyJson?.type ?? bodyJson?.topic ?? null

    if (!dataId || !type) {
      // Mercado Pago manda um ping de teste sem esses parâmetros às vezes — responde OK sem processar.
      return ok({ received: true })
    }

    // Serviço, não usuário: essa rota não tem sessão de ninguém logado, e as tabelas
    // envolvidas (payment_checkouts em escrita, mp_webhook_events, subscriptions de
    // outro usuário) não têm — de propósito — policy de escrita pra client nenhum.
    const supabase = createSupabaseService()

    const isActionableType = type === 'payment' || type === 'preapproval' || type === 'subscription_preapproval'

    // "merchant_order" e outros tipos são notificações do sistema antigo de IPN do
    // Mercado Pago, que nunca vêm com x-signature (só o esquema v2 de webhooks, usado
    // pra "payment"/"preapproval", assina) — exigir assinatura deles sempre falha com
    // 401, mesmo sendo o próprio Mercado Pago chamando de verdade. Como não agimos em
    // cima desses tipos (só registra e ignora), não há necessidade de verificar
    // assinatura — nenhuma ação sensível depende disso.
    if (!isActionableType) {
      const eventKey = `${type}:${dataId}`
      const { data: existingEvent } = await supabase
        .from('mp_webhook_events')
        .select('id')
        .eq('mp_event_key', eventKey)
        .maybeSingle()

      if (!existingEvent) {
        await supabase.from('mp_webhook_events').insert({ mp_event_key: eventKey, event_type: type, payload: { dataId } })
      }
      return ok({ received: true })
    }

    // A partir daqui é "payment"/"preapproval": aprova de verdade um pagamento e ativa
    // um plano. A notificação chega pelo notification_url da própria Preference/
    // Preapproval (mecanismo de IPN legado do Mercado Pago) — esse mecanismo NUNCA
    // manda x-signature (só o Webhooks v2, cadastrado à parte no painel do
    // desenvolvedor, assina); exigir sempre essa assinatura rejeitava 100% dos
    // pagamentos reais com 401, mesmo aprovados de verdade (visto em produção).
    // A segurança de verdade não depende do header: SEMPRE buscamos o status direto
    // na API do Mercado Pago com nosso próprio token (fetchPayment/fetchPreapproval
    // abaixo) antes de agir — um forjador não consegue inventar um pagamento aprovado
    // que não existe de fato na conta do Mercado Pago. Se um x-signature vier mesmo
    // assim (ex.: Webhooks v2 configurado no futuro), ainda validamos como defesa extra.
    const signatureHeader = req.headers.get('x-signature')
    if (signatureHeader) {
      const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
      if (secret) {
        const validSignature = verifyWebhookSignature({
          signatureHeader,
          requestId: req.headers.get('x-request-id'),
          dataId,
          secret,
        })
        if (!validSignature) {
          console.error('[webhook/mercadopago] assinatura inválida.', { dataId, type })
          return err(401, 'INVALID_SIGNATURE', 'Assinatura inválida.')
        }
      }
    }

    const eventKey = `${type}:${dataId}`
    const { data: existingEvent } = await supabase
      .from('mp_webhook_events')
      .select('id')
      .eq('mp_event_key', eventKey)
      .maybeSingle()

    if (existingEvent) return ok({ received: true }) // já processado — idempotente

    let externalReference: string | null = null
    let status: string | null = null
    let gatewaySubId: string | null = null
    let isRecurring = false

    if (type === 'payment') {
      const payment = await fetchPayment(dataId)
      externalReference = payment.external_reference
      status = payment.status
      gatewaySubId = String(payment.id)
    } else {
      const preapproval = await fetchPreapproval(dataId)
      externalReference = preapproval.external_reference
      status = preapproval.status
      gatewaySubId = preapproval.id
      isRecurring = true
    }

    await supabase
      .from('mp_webhook_events')
      .insert({ mp_event_key: eventKey, event_type: type, payload: { dataId, externalReference, status } })

    if (!externalReference) return ok({ received: true })

    const { data: checkout } = await supabase
      .from('payment_checkouts')
      .select('id, user_id, plan_id, coupon_redemption_id')
      .eq('mp_reference', externalReference)
      .maybeSingle()

    if (!checkout) {
      console.error('[webhook/mercadopago] checkout não encontrado pra external_reference:', externalReference)
      return ok({ received: true })
    }

    const approvedStatuses = isRecurring ? ['authorized'] : ['approved']
    const rejectedStatuses = isRecurring ? ['cancelled'] : ['rejected', 'cancelled']

    if (status && approvedStatuses.includes(status)) {
      await supabase.from('payment_checkouts').update({ status: 'approved' }).eq('id', checkout.id)

      const { data: activeSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', checkout.user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const subPayload = {
        plan_id:        checkout.plan_id,
        status:         'active',
        gateway:        'mercadopago',
        gateway_sub_id: gatewaySubId,
      }

      if (activeSub) {
        await supabase.from('subscriptions').update(subPayload).eq('id', activeSub.id)
      } else {
        await supabase.from('subscriptions').insert({ user_id: checkout.user_id, ...subPayload })
      }

      // Só marca o cupom como "gasto" agora que o pagamento foi confirmado de
      // verdade — um checkout abandonado/rejeitado deixa o cupom disponível de novo.
      if (checkout.coupon_redemption_id) {
        await supabase
          .from('coupon_redemptions')
          .update({ applied_at: new Date().toISOString() })
          .eq('id', checkout.coupon_redemption_id)
          .is('applied_at', null)
      }
    } else if (status && rejectedStatuses.includes(status)) {
      await supabase.from('payment_checkouts').update({ status: 'rejected' }).eq('id', checkout.id)
    }

    return ok({ received: true })
  } catch (error) {
    return handleApiError(error)
  }
}
