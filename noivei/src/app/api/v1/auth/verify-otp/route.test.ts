import { describe, it, expect, vi, beforeEach } from 'vitest'

const checkRateLimitMock = vi.fn()
const verifyOtpMock = vi.fn()

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
  getClientIp:    () => '203.0.113.10',
}))

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: () => ({}),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    auth: { verifyOtp: (...args: unknown[]) => verifyOtpMock(...args) },
  }),
}))

async function importRoute() {
  return import('./route')
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/auth/verify-otp', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

const validBody = { email: 'ana@example.com', token: '123456' }

describe('POST /api/v1/auth/verify-otp', () => {
  beforeEach(() => {
    vi.resetModules()
    checkRateLimitMock.mockReset()
    verifyOtpMock.mockReset()
    checkRateLimitMock.mockResolvedValue({ allowed: true, remaining: 10 })
  })

  it('deve confirmar o código quando ele é válido e o limite não foi atingido', async () => {
    verifyOtpMock.mockResolvedValue({
      data:  { session: { access_token: 'tok' }, user: { id: 'user-1' } },
      error: null,
    })

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.userId).toBe('user-1')
    expect(verifyOtpMock).toHaveBeenCalledWith({ email: 'ana@example.com', token: '123456', type: 'signup' })
  })

  it('deve bloquear a tentativa quando o limite por e-mail é atingido, sem chamar a verificação real', async () => {
    checkRateLimitMock
      .mockResolvedValueOnce({ allowed: true, remaining: 10 }) // ip
      .mockResolvedValueOnce({ allowed: false, remaining: 0 }) // identifier

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })

  it('deve bloquear a tentativa quando o limite por IP é atingido', async () => {
    checkRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0 })

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(429)
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })

  it('deve checar o limite sempre, dentro da própria rota, sem depender de pré-checagem do frontend', async () => {
    verifyOtpMock.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Token has expired' } })

    const { POST } = await importRoute()
    await POST(makeRequest(validBody))

    expect(checkRateLimitMock).toHaveBeenCalledTimes(2) // ip + identifier
  })

  it('deve retornar mensagem genérica para código inválido ou expirado, sem revelar o motivo interno', async () => {
    verifyOtpMock.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Token has expired or is invalid' } })

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.message).toBe('Código inválido ou expirado. Solicite um novo código.')
    // Verifica que o texto CRU do erro do Supabase não vaza — não que a palavra
    // "invalid" nunca apareça (o código de erro estável da própria rota,
    // INVALID_OTP, contém a palavra e não é um vazamento de motivo interno).
    expect(JSON.stringify(body)).not.toMatch(/token has expired or is invalid/i)
  })

  it('deve rejeitar payload inválido com erro de validação, antes de checar limite ou verificar', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'não-é-email', token: '' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(checkRateLimitMock).not.toHaveBeenCalled()
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })

  it('deve rejeitar código curto demais', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'ana@example.com', token: '123' }))

    expect(res.status).toBe(400)
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })

  it('nunca deve incluir o código digitado no corpo da resposta', async () => {
    verifyOtpMock.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'invalid' } })

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'ana@example.com', token: '999999' }))
    const rawBody = await res.text()

    expect(rawBody).not.toContain('999999')
  })
})
