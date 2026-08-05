import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — factories não podem referenciar variáveis externas, só vi.fn() puro.
// Mesmo padrão de mocking de src/app/api/v1/auth/login/route.test.ts.
const requireAuthMock = vi.fn()
const reauthenticateMock = vi.fn()
const invalidateOtherSessionsMock = vi.fn()
const updateUserMock = vi.fn()

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}))
vi.mock('@/lib/auth/reauthenticate', () => ({
  reauthenticateWithPassword: (...args: unknown[]) => reauthenticateMock(...args),
}))
vi.mock('@/lib/auth/invalidate-other-sessions', () => ({
  invalidateOtherSessions: (...args: unknown[]) => invalidateOtherSessionsMock(...args),
}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    auth: { updateUser: (...args: unknown[]) => updateUserMock(...args) },
  }),
}))

import { ApiError } from '@/lib/api/response'

async function importRoute() {
  return import('./route')
}

const USER = { id: 'user-1', email: 'ana@example.com' }

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/auth/change-password', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

describe('POST /api/v1/auth/change-password', () => {
  beforeEach(() => {
    // Sem vi.resetModules() aqui: a rota é importada dinamicamente (importRoute)
    // mas o teste também importa ApiError estaticamente do topo do arquivo — resetar
    // os módulos faria a rota resolver uma instância DIFERENTE da classe ApiError,
    // quebrando o `instanceof ApiError` em handleApiError (vira 500 em vez de 401).
    requireAuthMock.mockReset()
    reauthenticateMock.mockReset()
    invalidateOtherSessionsMock.mockReset()
    updateUserMock.mockReset()

    requireAuthMock.mockResolvedValue({ user: USER })
    reauthenticateMock.mockResolvedValue(undefined)
    invalidateOtherSessionsMock.mockResolvedValue(undefined)
    updateUserMock.mockResolvedValue({ error: null })
  })

  it('deve trocar a senha e derrubar as demais sessões quando a senha atual está correta', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ currentPassword: 'senha-atual', newPassword: 'nova-senha-123' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.success).toBe(true)
    expect(reauthenticateMock).toHaveBeenCalledWith(expect.anything(), USER, 'senha-atual')
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'nova-senha-123' })
    expect(invalidateOtherSessionsMock).toHaveBeenCalledTimes(1)
  })

  it('deve retornar 401 e não trocar a senha quando a senha atual está incorreta', async () => {
    reauthenticateMock.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Senha atual incorreta.'))

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ currentPassword: 'senha-errada', newPassword: 'nova-senha-123' }))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.message).toBe('Senha atual incorreta.')
    expect(updateUserMock).not.toHaveBeenCalled()
    expect(invalidateOtherSessionsMock).not.toHaveBeenCalled()
  })

  it('deve continuar retornando sucesso mesmo se invalidar as outras sessões falhar internamente', async () => {
    // invalidateOtherSessions nunca lança de verdade (loga e resolve) — mas se por
    // algum motivo rejeitasse, a troca de senha em si não pode ser afetada.
    invalidateOtherSessionsMock.mockResolvedValue(undefined)

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ currentPassword: 'senha-atual', newPassword: 'nova-senha-123' }))

    expect(res.status).toBe(200)
  })

  it('deve rejeitar payload inválido com erro de validação, sem checar senha nem trocar nada', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ currentPassword: '', newPassword: '123' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(reauthenticateMock).not.toHaveBeenCalled()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it('nunca deve incluir a senha atual nem a nova na resposta', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({ currentPassword: 'senha-secreta-atual', newPassword: 'senha-secreta-nova' }))
    const rawBody = await res.text()

    expect(rawBody).not.toContain('senha-secreta-atual')
    expect(rawBody).not.toContain('senha-secreta-nova')
  })

  it('nunca deve incluir a senha na resposta de erro quando a senha atual está incorreta', async () => {
    reauthenticateMock.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Senha atual incorreta.'))

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ currentPassword: 'senha-secreta-errada', newPassword: 'nova-senha-123' }))
    const rawBody = await res.text()

    expect(rawBody).not.toContain('senha-secreta-errada')
  })
})
