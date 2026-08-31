import { ok, err, handleApiError } from '@/lib/api/response'
import { fetchPayment, fetchPreapproval, verifyWebhookSignature } from '@/lib/integrations/payment/mercadopago'
import { createSupabaseService } from '@/lib/supabase/service'

interface MpWebhookBody {
  type?:  string
  topic?: string
  id?:    number | string
  data?:  { id?: string }
}

// Webhook ISOLADO de fornecedor (Fase 5) — espelha .../webhooks/mercadopago/route.ts
// (casal), mas só toca vendor_payment_checkouts/vendor_subscriptions, NUNCA
// payment_checkouts/subscriptions do casal: rota própria (notification_url
// diferente, configurada em vendor/billing/checkout/route.ts), decisão já aprovada
// (mesmo motivo de vendor_plans/vendor_subscriptions serem tabelas paralelas, ver
// 20260806000003). mp_webhook_events continua compartilhada com o resto do projeto
// (mesmo padrão de .../mercadopago-gifts/route.ts), mas toda mp_event_key aqui é
// prefixada "vendor:" — evita qualquer colisão teórica com a chave usada pelo
// webhook do casal (que nunca inclui esse prefixo), garantindo que um evento de
// CASAMENTO nunca seja tratado como já processado (ou processado de novo) por este
// handler, e vice-versa, mesmo que algum dataId um dia coincida entre as duas contas.
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
      return ok({ received: true })
    }

    const supabase = createSupabaseService()

    const isActionableType = type === 'payment' || type === 'preapproval' || type === 'subscription_preapproval'

    // Mesmo raciocínio do webhook do casal: "merchant_order" e outros tipos do IPN
    // legado nunca vêm com x-signature e não têm ação nenhuma associada aqui —
    // só registra e ignora.
    if (!isActionableType) {
      const eventKey = `vendor:${type}:${dataId}`
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

    // Mesmo raciocínio do webhook do casal: a notificação chega pelo notification_url
    // da própria Preference/Preapproval (IPN legado), que nunca manda x-signature —
    // a segurança de verdade vem de SEMPRE rebuscar o status direto na API do
    // Mercado Pago (fetchPayment/fetchPreapproval) antes de agir, nunca do corpo do
    // webhook em si. Se um x-signature vier mesmo assim, ainda validamos como defesa extra.
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
          console.error('[webhook/mercadopago-vendor] assinatura inválida.', { dataId, type })
          return err(401, 'INVALID_SIGNATURE', 'Assinatura inválida.')
        }
      }
    }

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

    // Inclui o status na chave (mesmo raciocínio do webhook do casal, achado real em
    // produção 2026-08-06: pending -> approved do MESMO dataId são DOIS eventos
    // distintos, PIX principalmente). Insert direto (não select-então-insert) pra
    // idempotência atômica via a UNIQUE constraint de mp_event_key.
    const eventKey = `vendor:${type}:${dataId}:${status ?? 'unknown'}`
    const { error: insertEventError } = await supabase
      .from('mp_webhook_events')
      .insert({ mp_event_key: eventKey, event_type: type, payload: { dataId, externalReference, status } })

    if (insertEventError) {
      if (insertEventError.code === '23505') return ok({ received: true }) // já processado — idempotente
      console.error('[webhook/mercadopago-vendor] falha ao registrar evento:', insertEventError)
      return err(500, 'DB_ERROR', 'Erro ao registrar o evento de webhook.')
    }

    if (!externalReference) return ok({ received: true })

    // Só busca em vendor_payment_checkouts — mp_reference é gerado por NÓS
    // (crypto.randomUUID() em vendor/billing/checkout/route.ts) e nunca colide com
    // o mp_reference de um checkout de casamento (tabela/gerador diferentes); um
    // evento de casamento nunca encontra linha aqui, e vice-versa por construção.
    const { data: checkout } = await supabase
      .from('vendor_payment_checkouts')
      .select('id, vendor_id, vendor_plan_id, coupon_redemption_id, mp_preapproval_id')
      .eq('mp_reference', externalReference)
      .maybeSingle()

    if (!checkout) {
      console.error('[webhook/mercadopago-vendor] checkout não encontrado pra external_reference:', externalReference)
      return ok({ received: true })
    }

    const approvedStatuses = isRecurring ? ['authorized'] : ['approved']
    const rejectedStatuses = isRecurring ? ['cancelled'] : ['rejected', 'cancelled']

    if (status && approvedStatuses.includes(status)) {
      await supabase.from('vendor_payment_checkouts').update({ status: 'approved' }).eq('id', checkout.id)

      const { data: activeSub } = await supabase
        .from('vendor_subscriptions')
        .select('id')
        .eq('vendor_id', checkout.vendor_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // current_period_end (mensal): NUNCA lido do corpo desta notificação — sempre
      // uma rebusca fresca do preapproval, usando o id que NÓS capturamos no
      // momento do checkout (checkout.mp_preapproval_id), não o dataId do evento
      // (que pode ser um id de PAGAMENTO avulso da cobrança do mês, não o da
      // assinatura). next_payment_date é o campo documentado pelo Mercado Pago
      // (SDKs oficiais) pra "quando é a próxima cobrança" — cada renovação bem-
      // sucedida atualiza este valor de novo, mantendo o período corrente correto
      // mês a mês. Só existe pra plano mensal; vitalício nunca tem mp_preapproval_id.
      let currentPeriodEnd: string | null = null
      if (checkout.mp_preapproval_id) {
        try {
          const freshPreapproval = await fetchPreapproval(checkout.mp_preapproval_id)
          currentPeriodEnd = freshPreapproval.next_payment_date ?? null
        } catch (fetchError) {
          // Nunca inventa uma data se a rebusca falhar — fica null (mesmo
          // comportamento de antes desta correção) em vez de aproximar.
          console.error('[webhook/mercadopago-vendor] falha ao rebuscar next_payment_date do preapproval:', fetchError)
        }
      }

      const subPayload = {
        plan_id:            checkout.vendor_plan_id,
        status:             'active',
        gateway:            'mercadopago',
        gateway_sub_id:     gatewaySubId,
        current_period_end: currentPeriodEnd,
        // Vitalício (lifetime) nunca tem expires_at — mesmo não-padrão de premium_once
        // do casal (ver comentário no topo de 20260806000002): sempre NULL pra sempre.
      }

      if (activeSub) {
        await supabase.from('vendor_subscriptions').update(subPayload).eq('id', activeSub.id)
      } else {
        await supabase.from('vendor_subscriptions').insert({ vendor_id: checkout.vendor_id, ...subPayload })
      }

      // Só marca o cupom como "gasto" agora que o pagamento foi confirmado de
      // verdade — um checkout abandonado/rejeitado deixa o cupom disponível de novo.
      if (checkout.coupon_redemption_id) {
        await supabase
          .from('vendor_coupon_redemptions')
          .update({ applied_at: new Date().toISOString() })
          .eq('id', checkout.coupon_redemption_id)
          .is('applied_at', null)
      }
    } else if (status && rejectedStatuses.includes(status)) {
      await supabase.from('vendor_payment_checkouts').update({ status: 'rejected' }).eq('id', checkout.id)
    }

    return ok({ received: true })
  } catch (error) {
    return handleApiError(error)
  }
}
