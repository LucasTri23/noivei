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

// Credenciais OAuth da "Application" da Wednest no Mercado Pago — diferentes do
// MERCADOPAGO_ACCESS_TOKEN acima (aquele é só um token nosso, usado pra vender a
// própria assinatura). Estas autorizam a Wednest a agir como marketplace: cada casal
// conecta a PRÓPRIA conta MP (fluxo OAuth), e o presente do convidado é processado
// com o token do casal, não o nosso — ver /api/v1/weddings/[wid]/gift-payments.
function getOAuthClientId(): string {
  const id = process.env.MERCADOPAGO_CLIENT_ID
  if (!id) throw new Error('MERCADOPAGO_CLIENT_ID não configurado.')
  return id
}

function getOAuthClientSecret(): string {
  const secret = process.env.MERCADOPAGO_CLIENT_SECRET
  if (!secret) throw new Error('MERCADOPAGO_CLIENT_SECRET não configurado.')
  return secret
}

// Token de teste (sandbox) sempre começa com "TEST-" — usado pra decidir se o
// usuário deve ser redirecionado pro checkout de sandbox ou de produção. Recebe o
// token que de fato foi usado pra criar o checkout (nosso ou o do casal conectado
// via OAuth) — sandbox é decidido pelo token da transação, não sempre pelo nosso.
function isSandboxToken(accessToken: string): boolean {
  return accessToken.startsWith('TEST-')
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
  // Presente de convidado (Fase 2): usa o token OAuth do CASAL (não o nosso) e retém
  // a comissão da Wednest via marketplace_fee — omitidos, é uma preferência normal
  // nossa (ex.: assinatura). accessToken ausente cai no nosso próprio token.
  accessToken?:       string
  marketplaceFeeBrl?: number
}

/**
 * Cria uma Preferência de pagamento avulso (Checkout Pro) — usada tanto pra planos
 * com billing_interval 'once' (token nosso) quanto pra presentes de convidado (token
 * OAuth do casal + marketplace_fee, ver gift-payments/checkout). `marketplace_fee` é
 * o campo documentado pela API de Preferences do Mercado Pago pra reter uma comissão
 * de marketplace num pagamento que cai na conta de terceiro — CONFERIR contra a doc
 * atual do MP/testar no sandbox antes de confiar em produção (assim como o formato
 * de x-signature abaixo, o Mercado Pago já mudou nome de campo de marketplace entre
 * versões da documentação).
 */
export async function createOneTimeCheckout(params: CreatePreferenceParams): Promise<CheckoutResult> {
  const accessToken = params.accessToken ?? getAccessToken()

  const res = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
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
      ...(params.marketplaceFeeBrl != null ? { marketplace_fee: params.marketplaceFeeBrl } : {}),
    }),
  })

  if (!res.ok) {
    throw new Error(`Mercado Pago (preference) ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as { id: string; init_point: string; sandbox_init_point: string }
  return { id: data.id, redirectUrl: isSandboxToken(accessToken) ? data.sandbox_init_point : data.init_point }
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

/** Cancela uma assinatura recorrente — para as cobranças futuras (não reembolsa o que já foi pago). */
export async function cancelPreapproval(preapprovalId: string): Promise<void> {
  const res = await fetch(`${MP_API_BASE}/preapproval/${preapprovalId}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken()}` },
    body:    JSON.stringify({ status: 'cancelled' }),
  })
  if (!res.ok) throw new Error(`Mercado Pago (cancel preapproval) ${res.status}: ${await res.text()}`)
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

// =========================================================
// OAuth marketplace — cada casal conecta a PRÓPRIA conta Mercado Pago pra receber
// presentes de convidado direto, sem o dinheiro passar pela conta da Wednest. Ver
// /api/v1/weddings/[wid]/gift-payments/{connect,disconnect,status} e
// /api/v1/billing/mp-oauth-callback.
// =========================================================

/** Monta a URL de autorização — o casal loga no MP dele e autoriza a Wednest. */
export function getOAuthAuthorizationUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id:     getOAuthClientId(),
    response_type: 'code',
    platform_id:   'mp',
    redirect_uri:  redirectUri,
    state,
  })
  return `https://auth.mercadopago.com/authorization?${params.toString()}`
}

export interface OAuthTokenResult {
  accessToken:  string
  refreshToken: string
  expiresIn:    number // segundos até expirar
  mpUserId:     string
}

async function parseOAuthTokenResponse(res: Response): Promise<OAuthTokenResult> {
  if (!res.ok) throw new Error(`Mercado Pago (oauth/token) ${res.status}: ${await res.text()}`)

  const data = (await res.json()) as {
    access_token: string; refresh_token: string; expires_in: number; user_id: number
  }
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresIn:    data.expires_in,
    mpUserId:     String(data.user_id),
  }
}

/** Troca o `code` do redirect de autorização pelo access_token/refresh_token do casal. */
export async function exchangeOAuthCode(code: string, redirectUri: string): Promise<OAuthTokenResult> {
  const res = await fetch(`${MP_API_BASE}/oauth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     getOAuthClientId(),
      client_secret: getOAuthClientSecret(),
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
    }),
  })
  return parseOAuthTokenResponse(res)
}

/** Renova o access_token do casal usando o refresh_token guardado (token expira, refresh não). */
export async function refreshOAuthAccessToken(refreshToken: string): Promise<OAuthTokenResult> {
  const res = await fetch(`${MP_API_BASE}/oauth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     getOAuthClientId(),
      client_secret: getOAuthClientSecret(),
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  return parseOAuthTokenResponse(res)
}

/** Busca e-mail/nickname da conta MP recém-conectada, só pra exibir "conectado como X" na UI. */
export async function fetchMpUserInfo(accessToken: string): Promise<{ email: string | null; nickname: string | null }> {
  const res = await fetch(`${MP_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return { email: null, nickname: null }

  const data = (await res.json()) as { email?: string; nickname?: string }
  return { email: data.email ?? null, nickname: data.nickname ?? null }
}
