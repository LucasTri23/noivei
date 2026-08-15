import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — factories não podem referenciar variáveis externas, só vi.fn() puro.
// Mesmo padrão de mocking de src/app/api/v1/weddings/[wid]/financial/route.test.ts.
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))
vi.mock('@/lib/weddings/get-user-wedding', () => ({
  getUserWedding:   vi.fn(),
  hasModuleAccess:  vi.fn(),
}))

import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { getUserWedding, hasModuleAccess } from '@/lib/weddings/get-user-wedding'
import { GET, POST } from './route'

const mockedRequireAuth          = vi.mocked(requireAuth)
const mockedCreateSupabaseServer = vi.mocked(createSupabaseServer)
const mockedCheckRateLimit       = vi.mocked(checkRateLimit)
const mockedGetUserWedding       = vi.mocked(getUserWedding)
const mockedHasModuleAccess      = vi.mocked(hasModuleAccess)

const USER_ID    = '22222222-2222-2222-2222-222222222222'
const WEDDING_ID = '11111111-1111-1111-1111-111111111111'
const VENDOR_ID  = '33333333-3333-4333-8333-333333333333'
const CONVERSATION_ID = '44444444-4444-4444-8444-444444444444'

function buildRequest(url: string, body?: unknown): Request {
  return new Request(url, {
    method:  body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    body === undefined ? undefined : JSON.stringify(body),
  })
}

interface SupabaseMockOptions {
  existingConversation?: Record<string, unknown> | null
  insertError?:          { code?: string; message: string } | null
  insertedRow?:           Record<string, unknown>
  isPublicVendor?:        boolean
  rpcListRows?:           unknown[]
}

function buildSupabaseMock(options: SupabaseMockOptions) {
  const insertedRows: Record<string, unknown>[] = []

  const rpc = vi.fn((fnName: string) => {
    if (fnName === 'fn_vendor_is_publicly_visible') {
      return Promise.resolve({ data: options.isPublicVendor ?? true, error: null })
    }
    if (fnName === 'fn_list_vendor_conversations') {
      return Promise.resolve({ data: options.rpcListRows ?? [], error: null })
    }
    throw new Error(`rpc não mockada no teste: ${fnName}`)
  })

  const from = vi.fn((table: string) => {
    if (table === 'vendor_conversations') {
      return {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: options.existingConversation ?? null, error: null }),
        insert: vi.fn((row: Record<string, unknown>) => {
          insertedRows.push(row)
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data:  options.insertError ? null : { id: CONVERSATION_ID, ...row, ...options.insertedRow },
              error: options.insertError ?? null,
            }),
          }
        }),
      }
    }
    throw new Error(`tabela não mockada no teste: ${table}`)
  })

  return { from, rpc, insertedRows }
}

describe('POST /api/v1/vendor-conversations', () => {
  beforeEach(() => {
    mockedRequireAuth.mockReset()
    mockedCreateSupabaseServer.mockReset()
    mockedCheckRateLimit.mockReset()
    mockedGetUserWedding.mockReset()
    mockedHasModuleAccess.mockReset()

    mockedRequireAuth.mockResolvedValue({ user: { id: USER_ID } } as never)
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10 })
    mockedGetUserWedding.mockResolvedValue({ id: WEDDING_ID, role: 'owner', isOwner: true, permissions: { full_access: true } } as never)
    mockedHasModuleAccess.mockReturnValue(true)
  })

  it('deve rejeitar com 403 quando o usuário não tem casamento com acesso ao módulo fornecedores', async () => {
    mockedGetUserWedding.mockResolvedValue(null)
    const supabase = buildSupabaseMock({})
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest('http://localhost/api/v1/vendor-conversations', { vendor_id: VENDOR_ID }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe('MODULE_ACCESS_DENIED')
    expect(supabase.insertedRows).toHaveLength(0)
  })

  it('deve rejeitar com 404 quando o fornecedor não existe ou não está publicamente visível', async () => {
    const supabase = buildSupabaseMock({ isPublicVendor: false })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest('http://localhost/api/v1/vendor-conversations', { vendor_id: VENDOR_ID }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('VENDOR_NOT_FOUND')
  })

  it('deve rejeitar payload inválido (vendor_id ausente/malformado) com 400', async () => {
    const supabase = buildSupabaseMock({})
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest('http://localhost/api/v1/vendor-conversations', { vendor_id: 'não-é-um-uuid' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(supabase.insertedRows).toHaveLength(0)
  })

  it('deve reaproveitar a conversa existente (200) em vez de criar outra quando já existe (UNIQUE wedding_id+vendor_id)', async () => {
    const supabase = buildSupabaseMock({
      existingConversation: { id: CONVERSATION_ID, wedding_id: WEDDING_ID, vendor_id: VENDOR_ID },
    })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest('http://localhost/api/v1/vendor-conversations', { vendor_id: VENDOR_ID }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe(CONVERSATION_ID)
    expect(supabase.insertedRows).toHaveLength(0)
  })

  it('deve criar a conversa (201) quando nenhuma existente é encontrada', async () => {
    const supabase = buildSupabaseMock({ existingConversation: null })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest('http://localhost/api/v1/vendor-conversations', { vendor_id: VENDOR_ID }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.id).toBe(CONVERSATION_ID)
    expect(supabase.insertedRows).toHaveLength(1)
    expect(supabase.insertedRows[0]).toEqual({ wedding_id: WEDDING_ID, vendor_id: VENDOR_ID, created_by: USER_ID })
  })

  it('deve rejeitar com 429 quando o rate limit de criação de conversa é excedido', async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })
    const supabase = buildSupabaseMock({})
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest('http://localhost/api/v1/vendor-conversations', { vendor_id: VENDOR_ID }))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(supabase.insertedRows).toHaveLength(0)
  })
})

describe('GET /api/v1/vendor-conversations', () => {
  beforeEach(() => {
    mockedRequireAuth.mockReset()
    mockedCreateSupabaseServer.mockReset()
    mockedRequireAuth.mockResolvedValue({ user: { id: USER_ID } } as never)
  })

  it('deve filtrar por viewer_role quando ?as= é passado', async () => {
    const rows = [
      { id: 'c1', viewer_role: 'couple', unread_count: 0 },
      { id: 'c2', viewer_role: 'vendor', unread_count: 2 },
    ]
    const supabase = buildSupabaseMock({ rpcListRows: rows })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await GET(buildRequest('http://localhost/api/v1/vendor-conversations?as=vendor'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([{ id: 'c2', viewer_role: 'vendor', unread_count: 2 }])
  })

  it('deve devolver as duas pontas quando ?as= não é passado (conta híbrida)', async () => {
    const rows = [
      { id: 'c1', viewer_role: 'couple', unread_count: 0 },
      { id: 'c2', viewer_role: 'vendor', unread_count: 2 },
    ]
    const supabase = buildSupabaseMock({ rpcListRows: rows })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await GET(buildRequest('http://localhost/api/v1/vendor-conversations'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
  })
})
