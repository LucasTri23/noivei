// Integração com Mercado Pago via REST direto (sem SDK) — evita depender de uma
// versão exata do pacote oficial e mantém a chamada transparente/auditável, mesmo
// padrão de outras integrações externas deste projeto (ex.: IBGE em onboarding).

import { createHmac, timingSafeEqual } from 'node:crypto'

const MP_API_BASE = 'https://api.mercadopago.com'

function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado.')
  return token
}

// Token de teste (sandbox) sempre começa com "TEST-" — usado pra decidir se o
// usuário deve ser redirecionado pro checkout de sandbox ou de produção.
function isSandbox(): boolean {
  return getAccessToken().startsWith('TEST-')
}

export interface CheckoutResult {
  id:          string
  redirectUrl: string
}

interface CreatePreferenceParams {
  itemTitle:         string
  amountBrl:         number // em reais (não centavos) — a API do Mercado Pago espera valor decimal
  externalReference: string
  successUrl:        string
  failureUrl:        string
  pendingUrl:        string
  notificationUrl:   string
}

/** Cria uma Preferência de pagamento avulso (Checkout Pro) — planos com billing_interval 'once'. */
export async function createOneTimeCheckout(params: CreatePreferenceParams): Promise<CheckoutResult> {
  const res = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken()}` },
    body: JSON.stringify({
      items: [{
        title:       params.itemTitle,
        quantity:    1,
        unit_price:  params.amountBrl,
        currency_id: 'BRL',
      }],
      external_reference: params.externalReference,
      back_urls: {
        success: params.successUrl,
        failure: params.failureUrl,
        pending: params.pendingUrl,
      },
      auto_return:      'approved',
      notification_url: params.notificationUrl,
    }),
  })

  if (!res.ok) {
    throw new Error(`Mercado Pago (preference) ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as { id: string; init_point: string; sandbox_init_point: string }
  return { id: data.id, redirectUrl: isSandbox() ? data.sandbox_init_point : data.init_point }
}

interface CreatePreapprovalParams {
  reason:            string
  payerEmail:        string
  amountBrl:         number
  externalReference: string
  backUrl:           string
  notificationUrl:   string
}

/** Cria uma assinatura recorrente mensal (Preapproval) — planos com billing_interval 'monthly'. */
export async function createSubscriptionCheckout(params: CreatePreapprovalParams): Promise<CheckoutResult> {
  const res = await fetch(`${MP_API_BASE}/preapproval`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken()}` },
    body: JSON.stringify({
      reason:             params.reason,
      external_reference: params.externalReference,
      payer_email:        params.payerEmail,
      back_url:           params.backUrl,
      notification_url:   params.notificationUrl,
      auto_recurring: {
        frequency:          1,
        frequency_type:     'months',
        transaction_amount: params.amountBrl,
        currency_id:        'BRL',
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`Mercado Pago (preapproval) ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as { id: string; init_point: string }
  return { id: data.id, redirectUrl: data.init_point }
}

export interface MpPayment {
  id:                 number
  status:             string
  external_reference: string | null
}

/** Rebusca o pagamento pelo id direto na API — nunca confia só no corpo do webhook. */
export async function fetchPayment(paymentId: string): Promise<MpPayment> {
  const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  })
  if (!res.ok) throw new Error(`Mercado Pago (get payment) ${res.status}: ${await res.text()}`)
  return (await res.json()) as MpPayment
}

export interface MpPreapproval {
  id:                 string
  status:             string
  external_reference: string | null
}

/** Rebusca a assinatura (preapproval) pelo id direto na API — nunca confia só no corpo do webhook. */
export async function fetchPreapproval(preapprovalId: string): Promise<MpPreapproval> {
  const res = await fetch(`${MP_API_BASE}/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  })
  if (!res.ok) throw new Error(`Mercado Pago (get preapproval) ${res.status}: ${await res.text()}`)
  return (await res.json()) as MpPreapproval
}

/**
 * Valida a assinatura do webhook (header x-signature) — sem isso, qualquer um
 * poderia forjar uma notificação de "pagamento aprovado" e ganhar o plano de graça.
 * Formato documentado pelo Mercado Pago: x-signature = "ts=<ts>,v1=<hash>"; o hash é
 * HMAC-SHA256 de "id:<dataId>;request-id:<x-request-id>;ts:<ts>;" usando o secret do
 * webhook, com <dataId> normalizado em minúsculas.
 *
 * IMPORTANTE: o formato exato (quais campos entram no manifest) já mudou entre
 * versões da documentação do Mercado Pago — teste contra o simulador de webhook do
 * painel deles antes de confiar nisso em produção.
 */
export function verifyWebhookSignature(params: {
  signatureHeader: string | null
  requestId:       string | null
  dataId:          string
  secret:          string
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = params
  if (!signatureHeader || !requestId) return false

  const parts: Record<string, string> = {}
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=')
    if (key && value !== undefined) parts[key.trim()] = value.trim()
  }

  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  const expectedBuf = Buffer.from(expected, 'hex')
  const providedBuf = Buffer.from(v1, 'hex')
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}
