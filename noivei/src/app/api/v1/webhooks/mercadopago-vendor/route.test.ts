import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — factories não podem referenciar variáveis externas, só vi.fn() puro.
vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: vi.fn(),
}))
vi.mock('@/lib/integrations/payment/mercadopago', () => ({
  fetchPayment:      vi.fn(),
  fetchPreapproval:   vi.fn(),
  verifyWebhookSignature: vi.fn(),
}))

import { fetchPayment, fetchPreapproval } from '@/lib/integrations/payment/mercadopago'
import { createSupabaseService } from '@/lib/supabase/service'
import { POST } from './route'

const mockedCreateSupabaseService = vi.mocked(createSupabaseService)
const mockedFetchPayment          = vi.mocked(fetchPayment)
const mockedFetchPreapproval       = vi.mocked(fetchPreapproval)

const VENDOR_ID    = '11111111-1111-1111-1111-111111111111'
const CHECKOUT_ID  = '22222222-2222-2222-2222-222222222222'
const MP_REFERENCE = 'mp-ref-abc'

function buildRequest(params: Record<string, string>): Request {
  const url = new URL('http://localhost/api/v1/webhooks/mercadopago-vendor')
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
}

interface SupabaseMockOptions {
  existingEvent?: { id: string } | null
  insertEventError?: { code?: string; message: string } | null
  checkout?: Record<string, unknown> | null
}

function buildSupabaseMock(options: SupabaseMockOptions) {
  const tablesTouched: string[] = []
  const updates: { table: string; payload: unknown }[] = []
  const inserts: { table: string; payload: unknown }[] = []

  const from = vi.fn((table: string) => {
    tablesTouched.push(table)

    if (table === 'mp_webhook_events') {
      return {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: options.existingEvent ?? null, error: null }),
        insert: vi.fn((payload: unknown) => {
          inserts.push({ table, payload })
          return Promise.resolve({ error: options.insertEventError ?? null })
        }),
      }
    }
    if (table === 'vendor_payment_checkouts') {
      return {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: options.checkout ?? null, error: null }),
        update: vi.fn((payload: unknown) => {
          updates.push({ table, payload })
          return { eq: vi.fn().mockResolvedValue({ error: null }) }
        }),
      }
    }
    if (table === 'vendor_subscriptions') {
      return {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(),
        limit:  vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // sem assinatura prévia
        insert: vi.fn((payload: unknown) => {
          inserts.push({ table, payload })
          return Promise.resolve({ error: null })
        }),
        update: vi.fn((payload: unknown) => {
          updates.push({ table, payload })
          return { eq: vi.fn().mockResolvedValue({ error: null }) }
        }),
      }
    }
    if (table === 'vendor_coupon_redemptions') {
      return {
        update: vi.fn((payload: unknown) => {
          updates.push({ table, payload })
          return { eq: vi.fn().mockReturnValue({ is: vi.fn().mockResolvedValue({ error: null }) }) }
        }),
      }
    }
    throw new Error(`tabela não mockada no teste: ${table}`)
  })

  return { from, tablesTouched, updates, inserts }
}

describe('POST /api/v1/webhooks/mercadopago-vendor', () => {
  beforeEach(() => {
    mockedCreateSupabaseService.mockReset()
    mockedFetchPayment.mockReset()
    mockedFetchPreapproval.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('deve ativar a assinatura do fornecedor quando um pagamento único (lifetime) é aprovado', async () => {
    mockedFetchPayment.mockResolvedValue({ id: 999, status: 'approved', external_reference: MP_REFERENCE })
    const supabase = buildSupabaseMock({
      checkout: { id: CHECKOUT_ID, vendor_id: VENDOR_ID, vendor_plan_id: 'vendor_lifetime', coupon_redemption_id: null },
    })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const res = await POST(buildRequest({ type: 'payment', 'data.id': '999' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.received).toBe(true)

    // Nunca toca em tabelas de casamento (payment_checkouts/subscriptions do casal)
    // — isolamento estrutural entre as duas cadeias de billing.
    expect(supabase.tablesTouched).not.toContain('payment_checkouts')
    expect(supabase.tablesTouched).not.toContain('subscriptions')

    const checkoutUpdate = supabase.updates.find((u) => u.table === 'vendor_payment_checkouts')
    expect(checkoutUpdate?.payload).toEqual({ status: 'approved' })

    const subInsert = supabase.inserts.find((i) => i.table === 'vendor_subscriptions')
    expect(subInsert?.payload).toEqual(
      expect.objectContaining({ vendor_id: VENDOR_ID, plan_id: 'vendor_lifetime', status: 'active', gateway: 'mercadopago' }),
    )
  })

  it('deve ser idempotente: reenvio do mesmo evento não deve reprocessar (não gera update duplicado)', async () => {
    mockedFetchPayment.mockResolvedValue({ id: 999, status: 'approved', external_reference: MP_REFERENCE })
    const supabase = buildSupabaseMock({
      insertEventError: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const res = await POST(buildRequest({ type: 'payment', 'data.id': '999' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.received).toBe(true)
    // Nunca chegou a buscar o checkout nem atualizar nada — o insert duplicado (23505)
    // interrompe o processamento antes disso.
    expect(supabase.tablesTouched).not.toContain('vendor_payment_checkouts')
  })

  it('deve namespacar a chave de idempotência com "vendor:" — nunca colide com a chave do webhook do casal', async () => {
    mockedFetchPayment.mockResolvedValue({ id: 999, status: 'approved', external_reference: MP_REFERENCE })
    const supabase = buildSupabaseMock({ checkout: null })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    await POST(buildRequest({ type: 'payment', 'data.id': '999' }))

    const eventInsert = supabase.inserts.find((i) => i.table === 'mp_webhook_events')
    expect((eventInsert?.payload as { mp_event_key: string }).mp_event_key).toMatch(/^vendor:/)
  })

  it('não deve ativar assinatura quando o checkout referenciado não existe (external_reference desconhecida)', async () => {
    mockedFetchPayment.mockResolvedValue({ id: 999, status: 'approved', external_reference: 'ref-inexistente' })
    const supabase = buildSupabaseMock({ checkout: null })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const res = await POST(buildRequest({ type: 'payment', 'data.id': '999' }))

    expect(res.status).toBe(200)
    expect(supabase.updates.find((u) => u.table === 'vendor_payment_checkouts')).toBeUndefined()
    expect(supabase.inserts.find((i) => i.table === 'vendor_subscriptions')).toBeUndefined()
  })

  it('deve marcar o checkout como rejeitado quando o pagamento é rejeitado, sem criar assinatura', async () => {
    mockedFetchPayment.mockResolvedValue({ id: 999, status: 'rejected', external_reference: MP_REFERENCE })
    const supabase = buildSupabaseMock({
      checkout: { id: CHECKOUT_ID, vendor_id: VENDOR_ID, vendor_plan_id: 'vendor_monthly', coupon_redemption_id: null },
    })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    await POST(buildRequest({ type: 'payment', 'data.id': '999' }))

    const checkoutUpdate = supabase.updates.find((u) => u.table === 'vendor_payment_checkouts')
    expect(checkoutUpdate?.payload).toEqual({ status: 'rejected' })
    expect(supabase.inserts.find((i) => i.table === 'vendor_subscriptions')).toBeUndefined()
  })

  it('preapproval "authorized" deve ativar assinatura mensal (fluxo de assinatura recorrente)', async () => {
    mockedFetchPreapproval.mockResolvedValue({ id: 'preapproval-1', status: 'authorized', external_reference: MP_REFERENCE })
    const supabase = buildSupabaseMock({
      checkout: { id: CHECKOUT_ID, vendor_id: VENDOR_ID, vendor_plan_id: 'vendor_monthly', coupon_redemption_id: null },
    })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const res = await POST(buildRequest({ type: 'preapproval', 'data.id': 'preapproval-1' }))

    expect(res.status).toBe(200)
    const subInsert = supabase.inserts.find((i) => i.table === 'vendor_subscriptions')
    expect(subInsert?.payload).toEqual(
      expect.objectContaining({ vendor_id: VENDOR_ID, plan_id: 'vendor_monthly', status: 'active', gateway_sub_id: 'preapproval-1' }),
    )
  })
})
