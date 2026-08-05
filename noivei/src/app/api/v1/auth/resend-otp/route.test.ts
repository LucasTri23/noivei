import { describe, it, expect, vi, beforeEach } from 'vitest'

const checkRateLimitMock = vi.fn()
const resendMock = vi.fn()

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
  getClientIp:    () => '203.0.113.10',
}))

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: () => ({}),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    auth: { resend: (...args: unknown[]) => resendMock(...args) },
  }),
}))

async function importRoute() {
  return import('./route')
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/auth/resend-otp', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

const validBody = { email: 'ana@example.com', captchaToken: 'tk' }

describe('POST /api/v1/auth/resend-otp', () => {
  beforeEach(() => {
    vi.resetModules()
    checkRateLimitMock.mockReset()
    resendMock.mockReset()
    checkRateLimitMock.mockResolvedValue({ allowed: true, remaining: 10 })
    resendMock.mockResolvedValue({ error: null })
  })

  it('deve retornar sucesso quando o e-mail existe e nenhum limite foi atingido', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.sent).toBe(true)
    expect(resendMock).toHaveBeenCalledWith({
      type:    'signup',
      email:   'ana@example.com',
      options: { captchaToken: 'tk' },
    })
  })

  it('deve retornar a MESMA resposta de sucesso quando o e-mail não existe ou já foi confirmado, sem revelar isso ao cliente', async () => {
    resendMock.mockResolvedValue({ error: { message: 'User already confirmed' } })

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.sent).toBe(true)
    expect(JSON.stringify(body)).not.toMatch(/already confirmed/i)
  })

  it('deve bloquear quando o limite por IP é atingido, sem chamar o reenvio real', async () => {
    checkRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0 }) // ip

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(body.error.message).toBe('Aguarde alguns minutos antes de solicitar um novo envio.')
    expect(resendMock).not.toHaveBeenCalled()
  })

  it('deve bloquear quando o limite por e-mail é atingido, sem chamar o reenvio real', async () => {
    checkRateLimitMock
      .mockResolvedValueOnce({ allowed: true, remaining: 10 })  // ip
      .mockResolvedValueOnce({ allowed: false, remaining: 0 })  // identifier

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(429)
    expect(resendMock).not.toHaveBeenCalled()
  })

  it('deve bloquear pelo cooldown curto quando o e-mail acabou de ser reenviado, mesmo com o limite principal livre', async () => {
    checkRateLimitMock
      .mockResolvedValueOnce({ allowed: true, remaining: 10 })  // ip
      .mockResolvedValueOnce({ allowed: true, remaining: 2 })   // identifier
      .mockResolvedValueOnce({ allowed: false, remaining: 0 })  // cooldown

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error.message).toBe('Aguarde alguns minutos antes de solicitar um novo envio.')
    expect(resendMock).not.toHaveBeenCalled()
    expect(checkRateLimitMock).toHaveBeenCalledTimes(3)
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(3, {}, 'resend_otp_cooldown:id:ana@example.com', 1, 60)
  })

  it('deve checar ip, identifier e cooldown, nessa ordem, dentro da própria rota', async () => {
    const { POST } = await importRoute()
    await POST(makeRequest(validBody))

    expect(checkRateLimitMock).toHaveBeenCalledTimes(3)
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(1, {}, 'resend_otp:ip:203.0.113.10', 5, 3600)
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(2, {}, 'resend_otp:id:ana@example.com', 3, 3600)
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(3, {}, 'resend_otp_cooldown:id:ana@example.com', 1, 60)
  })

  it('deve rejeitar payload inválido com erro de validação, antes de checar limite ou reenviar', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'não-é-email', captchaToken: 'tk' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(checkRateLimitMock).not.toHaveBeenCalled()
    expect(resendMock).not.toHaveBeenCalled()
  })

  it('deve exigir captchaToken', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'ana@example.com', captchaToken: '' }))

    expect(res.status).toBe(400)
    expect(resendMock).not.toHaveBeenCalled()
  })

  it('nunca deve incluir o captchaToken no corpo da resposta', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'ana@example.com', captchaToken: 'token-secreto' }))
    const rawBody = await res.text()

    expect(rawBody).not.toContain('token-secreto')
  })
})
