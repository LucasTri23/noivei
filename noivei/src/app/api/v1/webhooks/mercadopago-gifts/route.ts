import { ok, err, handleApiError } from '@/lib/api/response'
import { fetchPayment, verifyWebhookSignature } from '@/lib/integrations/payment/mercadopago'
import { createSupabaseService } from '@/lib/supabase/service'

interface MpWebhookBody {
  type?:  string
  topic?: string
  id?:    number | string
  data?:  { id?: string }
}

// Rota pública — notificação do Mercado Pago pra pagamentos de presente (Fase 2,
// marketplace/split: o pagamento em si acontece na conta do CASAL, não da Wednest).
// Mesmo desenho do webhook de assinatura (ver .../webhooks/mercadopago/route.ts),
// mas separado porque o efeito é diferente (marcar presente como dado, não ativar
// assinatura) e porque simplifica não misturar as duas tabelas de checkout num
// handler só. Usa o MESMO MERCADOPAGO_WEBHOOK_SECRET — a assinatura é da aplicação
// MP, não da conta que recebeu o pagamento.
//
// fetchPayment() usa o token da PRÓPRIA Wednest (não o do casal) — como a Wednest é
// a aplicação OAuth "dona" do pagamento marketplace, consegue ler os detalhes do
// pagamento mesmo sem ainda saber de qual casal/casamento se trata (só descobre isso
// depois, pelo external_reference). Precisa ser confirmado no sandbox: se a API não
// permitir, a alternativa é resolver o external_reference antes por outro meio.
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

    if (!dataId || !type || type !== 'payment') {
      // Presente é sempre pagamento avulso (Checkout Pro) — nunca preapproval.
      return ok({ received: true })
    }

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
    if (!secret) {
      console.error('[webhook/mercadopago-gifts] MERCADOPAGO_WEBHOOK_SECRET não configurado.')
      return err(500, 'CONFIG_ERROR', 'Webhook não configurado.')
    }

    const validSignature = verifyWebhookSignature({
      signatureHeader: req.headers.get('x-signature'),
      requestId:       req.headers.get('x-request-id'),
      dataId,
      secret,
    })
    if (!validSignature) {
      console.error('[webhook/mercadopago-gifts] assinatura inválida.', { dataId, type })
      return err(401, 'INVALID_SIGNATURE', 'Assinatura inválida.')
    }

    const supabase = createSupabaseService()

    const eventKey = `gift-payment:${dataId}`
    const { data: existingEvent } = await supabase
      .from('mp_webhook_events')
      .select('id')
      .eq('mp_event_key', eventKey)
      .maybeSingle()

    if (existingEvent) return ok({ received: true }) // já processado — idempotente

    const payment = await fetchPayment(dataId)
    const externalReference = payment.external_reference
    const status = payment.status

    await supabase
      .from('mp_webhook_events')
      .insert({ mp_event_key: eventKey, event_type: type, payload: { dataId, externalReference, status } })

    if (!externalReference) return ok({ received: true })

    const { data: checkout } = await supabase
      .from('gift_payment_checkouts')
      .select('id, gift_id, guest_name, status')
      .eq('mp_reference', externalReference)
      .maybeSingle()

    if (!checkout) {
      console.error('[webhook/mercadopago-gifts] checkout não encontrado pra external_reference:', externalReference)
      return ok({ received: true })
    }

    if (checkout.status !== 'pending') return ok({ received: true }) // já resolvido antes

    if (status === 'approved') {
      await supabase
        .from('gift_payment_checkouts')
        .update({ status: 'approved', mp_payment_id: String(payment.id) })
        .eq('id', checkout.id)

      await supabase
        .from('gift_registry_items')
        .update({ is_purchased: true, purchased_by: checkout.guest_name ?? 'Um convidado' })
        .eq('id', checkout.gift_id)
    } else if (status === 'rejected' || status === 'cancelled') {
      await supabase.from('gift_payment_checkouts').update({ status: 'rejected' }).eq('id', checkout.id)
    }

    return ok({ received: true })
  } catch (error) {
    return handleApiError(error)
  }
}
