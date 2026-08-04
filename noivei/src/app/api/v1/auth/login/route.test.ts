import { describe, it, expect, vi, beforeEach } from 'vitest'

const checkRateLimitMock = vi.fn()
const signInWithPasswordMock = vi.fn()

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
  getClientIp:    () => '203.0.113.10',
}))

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: () => ({}),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    auth: { signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args) },
  }),
}))

async function importRoute() {
  return import('./route')
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/auth/login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    vi.resetModules()
    checkRateLimitMock.mockReset()
    signInWithPasswordMock.mockReset()
    checkRateLimitMock.mockResolvedValue({ allowed: true, remaining: 10 })
  })

  it('deve permitir login quando as credenciais são válidas e o limite não foi atingido', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data:  { session: { access_token: 'tok' }, user: { id: 'user-1' } },
      error: null,
    })

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'ana@example.com', password: 'senha123', captchaToken: 'tk' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.userId).toBe('user-1')
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email:    'ana@example.com',
      password: 'senha123',
      options:  { captchaToken: 'tk' },
    })
  })

  it('deve bloquear a tentativa quando o limite por e-mail é atingido, sem chamar a autenticação real', async () => {
    checkRateLimitMock
      .mockResolvedValueOnce({ allowed: true, remaining: 10 }) // ip
      .mockResolvedValueOnce({ allowed: false, remaining: 0 }) // identifier

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'ana@example.com', password: 'senha123', captchaToken: 'tk' }))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(body.error.message).not.toMatch(/rate limit|supabase|gotrue/i)
    expect(signInWithPasswordMock).not.toHaveBeenCalled()
  })

  it('deve bloquear a tentativa quando o limite por IP é atingido', async () => {
    checkRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0 })

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'ana@example.com', password: 'senha123', captchaToken: 'tk' }))

    expect(res.status).toBe(429)
    expect(signInWithPasswordMock).not.toHaveBeenCalled()
  })

  it('deve não depender de nenhuma pré-checagem do frontend — checa o limite sempre, dentro da própria rota', async () => {
    signInWithPasswordMock.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'invalid' } })

    const { POST } = await importRoute()
    await POST(makeRequest({ email: 'ana@example.com', password: 'errada', captchaToken: 'tk' }))

    expect(checkRateLimitMock).toHaveBeenCalledTimes(2) // ip + identifier, sempre, sem depender de outra rota
  })

  it('deve retornar mensagem genérica para credenciais inválidas, sem revelar se o e-mail existe', async () => {
    signInWithPasswordMock.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid login credentials' } })

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'inexistente@example.com', password: 'qualquer', captchaToken: 'tk' }))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.message).toBe('E-mail ou senha incorretos.')
    expect(JSON.stringify(body)).not.toMatch(/invalid login credentials|user not found/i)
  })

  it('deve rejeitar payload inválido com erro de validação, antes de checar limite ou autenticar', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'não-é-email', password: '', captchaToken: '' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(checkRateLimitMock).not.toHaveBeenCalled()
    expect(signInWithPasswordMock).not.toHaveBeenCalled()
  })

  it('deve exigir captchaToken', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'ana@example.com', password: 'senha123', captchaToken: '' }))

    expect(res.status).toBe(400)
    expect(signInWithPasswordMock).not.toHaveBeenCalled()
  })

  it('nunca deve incluir a senha ou o captchaToken no corpo da resposta', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data:  { session: { access_token: 'tok' }, user: { id: 'user-1' } },
      error: null,
    })

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ email: 'ana@example.com', password: 'senha-secreta', captchaToken: 'token-secreto' }))
    const rawBody = await res.text()

    expect(rawBody).not.toContain('senha-secreta')
    expect(rawBody).not.toContain('token-secreto')
  })
})
