import { describe, it, expect, vi, beforeEach } from 'vitest'

const checkRateLimitMock = vi.fn()
const signUpMock = vi.fn()

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
  getClientIp:    () => '203.0.113.10',
}))

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: () => ({}),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    auth: { signUp: (...args: unknown[]) => signUpMock(...args) },
  }),
}))

async function importRoute() {
  return import('./route')
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/auth/signup', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

const validBody = {
  fullName: 'Ana Silva', email: 'ana@example.com', password: 'senha1234',
  terms: true, captchaToken: 'tk', origin: 'https://app.wednest.com.br',
}

describe('POST /api/v1/auth/signup', () => {
  beforeEach(() => {
    checkRateLimitMock.mockReset()
    signUpMock.mockReset()
    checkRateLimitMock.mockResolvedValue({ allowed: true, remaining: 10 })
  })

  it('deve criar a conta quando os dados são válidos e o limite não foi atingido', async () => {
    signUpMock.mockResolvedValue({ data: {}, error: null })

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.email).toBe('ana@example.com')
    expect(signUpMock).toHaveBeenCalledWith({
      email:    'ana@example.com',
      password: 'senha1234',
      options: {
        data:            { full_name: 'Ana Silva' },
        emailRedirectTo: 'https://app.wednest.com.br/auth/callback',
        captchaToken:    'tk',
      },
    })
  })

  it('deve bloquear quando o limite por e-mail é atingido, sem chamar o cadastro real', async () => {
    checkRateLimitMock
      .mockResolvedValueOnce({ allowed: true, remaining: 10 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0 })

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(429)
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('deve retornar mensagem genérica quando o e-mail já está cadastrado, sem confirmar isso ao cliente', async () => {
    signUpMock.mockResolvedValue({ data: null, error: { message: 'User already registered' } })

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.message).toBe('Não foi possível criar a conta. Se você já tem cadastro, tente entrar.')
    expect(JSON.stringify(body)).not.toMatch(/already registered/i)
  })

  it('deve rejeitar quando os termos não foram aceitos', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ ...validBody, terms: false }))

    expect(res.status).toBe(400)
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('deve rejeitar senha curta', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ ...validBody, password: '123' }))

    expect(res.status).toBe(400)
    expect(signUpMock).not.toHaveBeenCalled()
  })
})
