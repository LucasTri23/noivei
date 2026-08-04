import { describe, it, expect, vi, beforeEach } from 'vitest'

const checkRateLimitMock = vi.fn()
const resetPasswordForEmailMock = vi.fn()

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
  getClientIp:    () => '203.0.113.10',
}))

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: () => ({}),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    auth: { resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmailMock(...args) },
  }),
}))

async function importRoute() {
  return import('./route')
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/auth/forgot-password', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

const validBody = { email: 'ana@example.com', captchaToken: 'tk', origin: 'https://app.wednest.com.br' }

describe('POST /api/v1/auth/forgot-password', () => {
  beforeEach(() => {
    checkRateLimitMock.mockReset()
    resetPasswordForEmailMock.mockReset()
    checkRateLimitMock.mockResolvedValue({ allowed: true, remaining: 10 })
    resetPasswordForEmailMock.mockResolvedValue({ error: null })
  })

  it('deve retornar sucesso quando o e-mail existe', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.sent).toBe(true)
  })

  it('deve retornar a MESMA resposta de sucesso quando o e-mail não existe, sem revelar isso ao cliente', async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: { message: 'User not found' } })

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.sent).toBe(true)
    expect(JSON.stringify(body)).not.toMatch(/not found/i)
  })

  it('deve bloquear quando o limite é atingido', async () => {
    checkRateLimitMock
      .mockResolvedValueOnce({ allowed: true, remaining: 10 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0 })

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(429)
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled()
  })

  it('deve rejeitar e-mail inválido', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ ...validBody, email: 'não-é-email' }))

    expect(res.status).toBe(400)
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled()
  })
})
