import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/api/guards/vendor', () => ({ requireVendorProfile: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('@/lib/integrations/payment/mercadopago', () => ({
  createOneTimeCheckout:     vi.fn(),
  createSubscriptionCheckout: vi.fn(),
}))

import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { requireAuth } from '@/lib/auth/require-auth'
import { createOneTimeCheckout } from '@/lib/integrations/payment/mercadopago'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { POST } from './route'

const mockedRequireAuth          = vi.mocked(requireAuth)
const mockedRequireVendorProfile = vi.mocked(requireVendorProfile)
const mockedCreateSupabaseServer = vi.mocked(createSupabaseServer)
const mockedCheckRateLimit       = vi.mocked(checkRateLimit)
const mockedCreateOneTimeCheckout = vi.mocked(createOneTimeCheckout)

const VENDOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/vendor/billing/checkout', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

function buildSupabaseMock() {
  const insertedCheckouts: Record<string, unknown>[] = []

  const from = vi.fn((table: string) => {
    if (table === 'vendor_plans') {
      return {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'vendor_lifetime', name: 'Vitalício', price_cents: 50000, billing_type: 'lifetime', active: true },
          error: null,
        }),
      }
    }
    if (table === 'vendor_payment_checkouts') {
      return {
        insert: vi.fn((payload: Record<string, unknown>) => {
          insertedCheckouts.push(payload)
          return { select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'checkout-1' }, error: null }) }) }
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }
    }
    throw new Error(`tabela não mockada no teste: ${table}`)
  })

  const rpc = vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })

  return { from, rpc, insertedCheckouts }
}

describe('POST /api/v1/vendor/billing/checkout', () => {
  beforeEach(() => {
    mockedRequireAuth.mockReset()
    mockedRequireVendorProfile.mockReset()
    mockedCreateSupabaseServer.mockReset()
    mockedCheckRateLimit.mockReset()
    mockedCreateOneTimeCheckout.mockReset()

    mockedRequireAuth.mockResolvedValue({ user: { id: 'user-1', email: 'fornecedor@example.com' } } as never)
    mockedRequireVendorProfile.mockResolvedValue({ id: VENDOR_ID } as never)
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99 })
    mockedCreateOneTimeCheckout.mockResolvedValue({ id: 'pref-1', redirectUrl: 'https://mp.example/checkout' })
  })

  it('nunca deve confiar em preço/valor vindo do body — sempre usa vendor_plans.price_cents do banco', async () => {
    const supabase = buildSupabaseMock()
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    // Corpo malicioso tentando injetar um preço bem menor que o real (R$5000 -> ignorado).
    const res = await POST(buildRequest({ vendor_plan_id: 'vendor_lifetime', price_cents: 1, amount_cents: 1 }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(supabase.insertedCheckouts).toEqual([
      expect.objectContaining({ vendor_id: VENDOR_ID, vendor_plan_id: 'vendor_lifetime', amount_cents: 50000, discount_cents: 0 }),
    ])
    // O valor mandado pro Mercado Pago também vem do banco, não do body malicioso.
    expect(mockedCreateOneTimeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ amountBrl: 500 }),
    )
    expect(body.data.redirect_url).toBe('https://mp.example/checkout')
  })

  it('deve rejeitar plano inexistente/inativo', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'vendor_plans') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }
      throw new Error(`tabela não mockada: ${table}`)
    })
    mockedCreateSupabaseServer.mockResolvedValue({ from } as never)

    const res = await POST(buildRequest({ vendor_plan_id: 'plano-fake' }))

    expect(res.status).toBe(404)
  })
})
