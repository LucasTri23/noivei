import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — factories não podem referenciar variáveis externas, só vi.fn() puro.
// Mesmo padrão de mocking de src/app/api/v1/auth/login/route.test.ts.
const requireAuthMock = vi.fn()
const reauthenticateMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}))
vi.mock('@/lib/auth/reauthenticate', () => ({
  reauthenticateWithPassword: (...args: unknown[]) => reauthenticateMock(...args),
}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    from: (...args: unknown[]) => fromMock(...args),
  }),
}))

import { ApiError } from '@/lib/api/response'

async function importRoute() {
  return import('./route')
}

const USER = { id: 'user-1', email: 'ana@example.com' }

// Encadeia .update().eq().is() como a rota real usa — resolve o "await" no final
// da cadeia (is()), mesmo padrão dos outros testes de rota deste projeto.
function buildWeddingsQuery(error: { message: string } | null = null) {
  const is = vi.fn().mockResolvedValue({ error })
  const eq = vi.fn().mockReturnValue({ is })
  const update = vi.fn().mockReturnValue({ eq })
  return { update, eq, is }
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/account/delete', {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

describe('DELETE /api/v1/account/delete', () => {
  beforeEach(() => {
    // Sem vi.resetModules() aqui: a rota é importada dinamicamente (importRoute)
    // mas o teste também importa ApiError estaticamente do topo do arquivo — resetar
    // os módulos faria a rota resolver uma instância DIFERENTE da classe ApiError,
    // quebrando o `instanceof ApiError` em handleApiError (vira 500 em vez de 401).
    requireAuthMock.mockReset()
    reauthenticateMock.mockReset()
    fromMock.mockReset()

    requireAuthMock.mockResolvedValue({ user: USER })
    reauthenticateMock.mockResolvedValue(undefined)
  })

  it('deve rejeitar com 401 e não marcar nada para exclusão quando a senha atual está incorreta', async () => {
    reauthenticateMock.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Senha atual incorreta.'))
    const query = buildWeddingsQuery()
    fromMock.mockReturnValue(query)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeRequest({ currentPassword: 'senha-errada' }))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.message).toBe('Senha atual incorreta.')
    expect(query.update).not.toHaveBeenCalled()
  })

  it('deve prosseguir com a exclusão (soft delete) quando a senha atual está correta', async () => {
    const query = buildWeddingsQuery()
    fromMock.mockReturnValue(query)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeRequest({ currentPassword: 'senha-correta' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.scheduled_purge_at).toBeDefined()
    expect(reauthenticateMock).toHaveBeenCalledWith(expect.anything(), USER, 'senha-correta')
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false, deleted_at: expect.any(String) }),
    )
    expect(query.eq).toHaveBeenCalledWith('user_id', USER.id)
  })

  it('deve rejeitar payload sem senha atual com erro de validação, sem checar autenticação', async () => {
    const { DELETE } = await importRoute()
    const res = await DELETE(makeRequest({}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(requireAuthMock).not.toHaveBeenCalled()
    expect(reauthenticateMock).not.toHaveBeenCalled()
  })

  it('nunca deve incluir a senha na resposta', async () => {
    const query = buildWeddingsQuery()
    fromMock.mockReturnValue(query)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeRequest({ currentPassword: 'senha-secreta' }))
    const rawBody = await res.text()

    expect(rawBody).not.toContain('senha-secreta')
  })
})
