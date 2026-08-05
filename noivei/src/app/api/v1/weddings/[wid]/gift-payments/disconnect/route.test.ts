import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — factories não podem referenciar variáveis externas, só vi.fn() puro.
// Mesmo padrão de mocking de src/app/api/v1/auth/login/route.test.ts.
const requireAuthMock = vi.fn()
const reauthenticateMock = vi.fn()
const requireWeddingOwnerOrFullAccessMock = vi.fn()
const serviceFromMock = vi.fn()

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}))
vi.mock('@/lib/auth/reauthenticate', () => ({
  reauthenticateWithPassword: (...args: unknown[]) => reauthenticateMock(...args),
}))
vi.mock('@/lib/api/guards/ownership', () => ({
  requireWeddingOwnerOrFullAccess: (...args: unknown[]) => requireWeddingOwnerOrFullAccessMock(...args),
}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({}),
}))
vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: () => ({ from: (...args: unknown[]) => serviceFromMock(...args) }),
}))

import { ApiError } from '@/lib/api/response'

async function importRoute() {
  return import('./route')
}

const USER = { id: 'user-1', email: 'ana@example.com' }
const WEDDING_ID = '11111111-1111-1111-1111-111111111111'

// Encadeia .delete().eq() como a rota real usa.
function buildMpAccountsQuery(error: { message: string } | null = null) {
  const eq = vi.fn().mockResolvedValue({ error })
  const del = vi.fn().mockReturnValue({ eq })
  return { delete: del, eq }
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/weddings/x/gift-payments/disconnect', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

function makeParams() {
  return { params: Promise.resolve({ wid: WEDDING_ID }) }
}

describe('POST /api/v1/weddings/[wid]/gift-payments/disconnect', () => {
  beforeEach(() => {
    // Sem vi.resetModules() aqui: a rota é importada dinamicamente (importRoute)
    // mas o teste também importa ApiError estaticamente do topo do arquivo — resetar
    // os módulos faria a rota resolver uma instância DIFERENTE da classe ApiError,
    // quebrando o `instanceof ApiError` em handleApiError (vira 500 em vez de 401).
    requireAuthMock.mockReset()
    reauthenticateMock.mockReset()
    requireWeddingOwnerOrFullAccessMock.mockReset()
    serviceFromMock.mockReset()

    requireAuthMock.mockResolvedValue({ user: USER })
    reauthenticateMock.mockResolvedValue(undefined)
    requireWeddingOwnerOrFullAccessMock.mockResolvedValue(undefined)
  })

  it('deve rejeitar com 401 e não desconectar nada quando a senha atual está incorreta', async () => {
    reauthenticateMock.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Senha atual incorreta.'))
    const query = buildMpAccountsQuery()
    serviceFromMock.mockReturnValue(query)

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ currentPassword: 'senha-errada' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.message).toBe('Senha atual incorreta.')
    expect(requireWeddingOwnerOrFullAccessMock).not.toHaveBeenCalled()
    expect(query.delete).not.toHaveBeenCalled()
  })

  it('deve desconectar quando a senha atual está correta e o usuário tem acesso ao casamento', async () => {
    const query = buildMpAccountsQuery()
    serviceFromMock.mockReturnValue(query)

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ currentPassword: 'senha-correta' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.disconnected).toBe(true)
    expect(reauthenticateMock).toHaveBeenCalledWith(expect.anything(), USER, 'senha-correta')
    expect(requireWeddingOwnerOrFullAccessMock).toHaveBeenCalledWith(expect.anything(), WEDDING_ID, USER.id)
    expect(query.delete).toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('wedding_id', WEDDING_ID)
  })

  it('deve rejeitar payload sem senha atual com erro de validação, sem checar autenticação', async () => {
    const { POST } = await importRoute()
    const res = await POST(makeRequest({}), makeParams())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(requireAuthMock).not.toHaveBeenCalled()
    expect(reauthenticateMock).not.toHaveBeenCalled()
  })

  it('nunca deve incluir a senha na resposta', async () => {
    const query = buildMpAccountsQuery()
    serviceFromMock.mockReturnValue(query)

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ currentPassword: 'senha-secreta' }), makeParams())
    const rawBody = await res.text()

    expect(rawBody).not.toContain('senha-secreta')
  })
})
