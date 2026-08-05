import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resolveWeddingPlanIdMock = vi.fn()

vi.mock('@/lib/billing/check-limit', () => ({
  resolveWeddingPlanId: (...args: unknown[]) => resolveWeddingPlanIdMock(...args),
}))

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: vi.fn(),
}))

import { createSupabaseService } from '@/lib/supabase/service'
import { GET } from './route'

const mockedCreateSupabaseService = vi.mocked(createSupabaseService)

const CRON_SECRET = 'test-cron-secret'

function buildSupabaseMock(options: {
  weddings: { id: string; wedding_date: string }[]
  weddingsError?: { message: string } | null
  retentionDays?: number
  updateError?: { message: string } | null
}) {
  const updateCalls: string[] = []

  const weddingsQuery = {
    select: vi.fn().mockReturnThis(),
    is:     vi.fn().mockReturnThis(),
    not:    vi.fn().mockReturnThis(),
    lt:     vi.fn().mockResolvedValue({ data: options.weddings, error: options.weddingsError ?? null }),
  }

  const planLimitsQuery = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { value: options.retentionDays ?? 30 },
      error: null,
    }),
  }

  const from = vi.fn((table: string) => {
    if (table === 'weddings') {
      return {
        ...weddingsQuery,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockImplementation(function (this: { _weddingId?: string }) {
            updateCalls.push('marked')
            return Promise.resolve({ error: options.updateError ?? null })
          }),
        }),
      }
    }
    if (table === 'plan_limits') return planLimitsQuery
    throw new Error(`tabela não mockada no teste: ${table}`)
  })

  return { from, updateCalls }
}

function buildRequest(secret = CRON_SECRET): Request {
  return new Request('http://localhost/api/cron/auto-delete-after-wedding', {
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('GET /api/cron/auto-delete-after-wedding', () => {
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET
    mockedCreateSupabaseService.mockReset()
    resolveWeddingPlanIdMock.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret
    vi.restoreAllMocks()
  })

  it('deve rejeitar requisição sem o CRON_SECRET correto', async () => {
    const supabase = buildSupabaseMock({ weddings: [] })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const response = await GET(buildRequest('secret-errado'))

    expect(response.status).toBe(401)
  })

  it('deve marcar pra exclusão um casamento do plano Gratuito com mais de 30 dias desde a data do casamento', async () => {
    const oldEnough = new Date()
    oldEnough.setDate(oldEnough.getDate() - 31)
    const weddingDate = oldEnough.toISOString().slice(0, 10)

    const supabase = buildSupabaseMock({
      weddings: [{ id: 'wedding-free-old', wedding_date: weddingDate }],
      retentionDays: 30,
    })
    resolveWeddingPlanIdMock.mockResolvedValue('free')
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.markedForDeletion).toBe(1)
  })

  it('não deve marcar pra exclusão um casamento de plano pago com menos de 365 dias desde a data do casamento', async () => {
    const notOldEnough = new Date()
    notOldEnough.setDate(notOldEnough.getDate() - 40) // passou dos 30 do Gratuito, mas não dos 365 do pago
    const weddingDate = notOldEnough.toISOString().slice(0, 10)

    const supabase = buildSupabaseMock({
      weddings: [{ id: 'wedding-paid-recent', wedding_date: weddingDate }],
      retentionDays: 365,
    })
    resolveWeddingPlanIdMock.mockResolvedValue('premium_monthly')
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.markedForDeletion).toBe(0)
  })
})
