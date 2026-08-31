import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/api/guards/vendor', () => ({ requireVendorProfile: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createSupabaseService: vi.fn() }))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('@/lib/integrations/payment/mercadopago', () => ({
  cancelPreapproval: vi.fn(),
  fetchPreapproval:  vi.fn(),
}))

import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { requireAuth } from '@/lib/auth/require-auth'
import { cancelPreapproval, fetchPreapproval } from '@/lib/integrations/payment/mercadopago'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'
import { POST } from './route'

const mockedRequireAuth          = vi.mocked(requireAuth)
const mockedRequireVendorProfile = vi.mocked(requireVendorProfile)
const mockedCreateSupabaseServer = vi.mocked(createSupabaseServer)
const mockedCreateSupabaseService = vi.mocked(createSupabaseService)
const mockedCheckRateLimit       = vi.mocked(checkRateLimit)
const mockedCancelPreapproval    = vi.mocked(cancelPreapproval)
const mockedFetchPreapproval     = vi.mocked(fetchPreapproval)

const VENDOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SUB_ID    = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function buildSubscriptionQuery(subscription: Record<string, unknown> | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    limit:  vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: subscription, error: null }),
  }
}

// vendor_subscriptions não tem policy de UPDATE pra `authenticated` (ver comentário
// na rota) — a leitura usa o client normal (mockedCreateSupabaseServer), mas a
// escrita final tem que passar por createSupabaseService(), mockado à parte aqui,
// senão o teste não pegaria a regressão real que motivou essa separação.
function buildSupabaseMock(subscription: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = []

  const readOnlyFrom = vi.fn((table: string) => {
    if (table === 'vendor_subscriptions') return buildSubscriptionQuery(subscription)
    throw new Error(`tabela não mockada no teste (server): ${table}`)
  })

  const serviceFrom = vi.fn((table: string) => {
    if (table === 'vendor_subscriptions') {
      return {
        update: vi.fn((payload: Record<string, unknown>) => {
          updates.push(payload)
          return { eq: vi.fn().mockResolvedValue({ error: null }) }
        }),
      }
    }
    throw new Error(`tabela não mockada no teste (service): ${table}`)
  })

  return { readOnlyFrom, serviceFrom, updates }
}

describe('POST /api/v1/vendor/billing/cancel-subscription', () => {
  beforeEach(() => {
    mockedRequireAuth.mockReset()
    mockedRequireVendorProfile.mockReset()
    mockedCreateSupabaseServer.mockReset()
    mockedCreateSupabaseService.mockReset()
    mockedCheckRateLimit.mockReset()
    mockedCancelPreapproval.mockReset()
    mockedFetchPreapproval.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mockedRequireAuth.mockResolvedValue({ user: { id: 'user-1' } } as never)
    mockedRequireVendorProfile.mockResolvedValue({ id: VENDOR_ID } as never)
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99 })
    mockedCancelPreapproval.mockResolvedValue(undefined)
  })

  const activeMonthly = {
    id: SUB_ID, plan_id: 'vendor_monthly', gateway: 'mercadopago', gateway_sub_id: 'preapproval-1',
    current_period_end: null, vendor_plans: { billing_type: 'monthly' },
  }

  it('deve conceder carência até next_payment_date quando o Mercado Pago informa uma data futura confiável', async () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    mockedFetchPreapproval.mockResolvedValue({ id: 'preapproval-1', status: 'authorized', external_reference: null, next_payment_date: futureDate })
    const supabase = buildSupabaseMock(activeMonthly)
    mockedCreateSupabaseServer.mockResolvedValue({ from: supabase.readOnlyFrom } as never)
    mockedCreateSupabaseService.mockReturnValue({ from: supabase.serviceFrom } as never)

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ cancelled: true, access_until: futureDate })
    // Rebusca ANTES de cancelar (a assinatura pode ter next_payment_date limpo
    // depois de cancelled no Mercado Pago) — ambas chamadas precisam ter acontecido,
    // e nessa ordem.
    expect(mockedFetchPreapproval).toHaveBeenCalledWith('preapproval-1')
    expect(mockedCancelPreapproval).toHaveBeenCalledWith('preapproval-1')
    expect(supabase.updates[0]).toEqual({
      cancel_at_period_end: true, current_period_end: futureDate, expires_at: futureDate,
    })
  })

  it('deve cancelar imediatamente quando o Mercado Pago não informa next_payment_date (nunca inventa uma data)', async () => {
    mockedFetchPreapproval.mockResolvedValue({ id: 'preapproval-1', status: 'authorized', external_reference: null, next_payment_date: null })
    const supabase = buildSupabaseMock(activeMonthly)
    mockedCreateSupabaseServer.mockResolvedValue({ from: supabase.readOnlyFrom } as never)
    mockedCreateSupabaseService.mockReturnValue({ from: supabase.serviceFrom } as never)

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ cancelled: true, access_until: null })
    expect(supabase.updates[0]).toEqual({ status: 'canceled', cancel_at_period_end: true })
  })

  it('deve cancelar imediatamente quando a rebusca do preapproval falha (falha não bloqueia o cancelamento)', async () => {
    mockedFetchPreapproval.mockRejectedValue(new Error('timeout'))
    const supabase = buildSupabaseMock(activeMonthly)
    mockedCreateSupabaseServer.mockResolvedValue({ from: supabase.readOnlyFrom } as never)
    mockedCreateSupabaseService.mockReturnValue({ from: supabase.serviceFrom } as never)

    const res = await POST()

    expect(res.status).toBe(200)
    expect(mockedCancelPreapproval).toHaveBeenCalled() // cancelamento no MP prossegue mesmo assim
    expect(supabase.updates[0]).toEqual({ status: 'canceled', cancel_at_period_end: true })
  })

  it('deve tratar next_payment_date passado como sem período restante (cancelamento imediato)', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    mockedFetchPreapproval.mockResolvedValue({ id: 'preapproval-1', status: 'authorized', external_reference: null, next_payment_date: pastDate })
    const supabase = buildSupabaseMock(activeMonthly)
    mockedCreateSupabaseServer.mockResolvedValue({ from: supabase.readOnlyFrom } as never)
    mockedCreateSupabaseService.mockReturnValue({ from: supabase.serviceFrom } as never)

    const res = await POST()
    const body = await res.json()

    expect(body.data.access_until).toBeNull()
    expect(supabase.updates[0]).toEqual({ status: 'canceled', cancel_at_period_end: true })
  })

  it('não deve cancelar plano vitalício (sem nada a cancelar)', async () => {
    const supabase = buildSupabaseMock({ ...activeMonthly, vendor_plans: { billing_type: 'lifetime' } })
    mockedCreateSupabaseServer.mockResolvedValue({ from: supabase.readOnlyFrom } as never)
    mockedCreateSupabaseService.mockReturnValue({ from: supabase.serviceFrom } as never)

    const res = await POST()

    expect(res.status).toBe(400)
    expect(mockedCancelPreapproval).not.toHaveBeenCalled()
  })

  it('deve retornar 404 quando não há assinatura ativa', async () => {
    const supabase = buildSupabaseMock(null)
    mockedCreateSupabaseServer.mockResolvedValue({ from: supabase.readOnlyFrom } as never)
    mockedCreateSupabaseService.mockReturnValue({ from: supabase.serviceFrom } as never)

    const res = await POST()

    expect(res.status).toBe(404)
  })
})
