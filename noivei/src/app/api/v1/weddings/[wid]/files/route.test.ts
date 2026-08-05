import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — os factories não podem referenciar variáveis externas, só vi.fn()
// puro. A configuração de retorno de cada teste é feita via mockReturnValue/mockResolvedValue
// nos mocks importados abaixo (mesmo padrão de src/app/api/cron/purge-accounts/route.test.ts).
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/api/guards/ownership', () => ({
  requireWeddingOwnership: vi.fn(),
  requireModuleAccess:     vi.fn(),
}))
vi.mock('@/lib/billing/check-limit', () => ({
  checkStorageLimit: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}))

import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkStorageLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { POST } from './route'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedRequireWeddingOwnership = vi.mocked(requireWeddingOwnership)
const mockedRequireModuleAccess = vi.mocked(requireModuleAccess)
const mockedCheckStorageLimit = vi.mocked(checkStorageLimit)
const mockedCreateSupabaseServer = vi.mocked(createSupabaseServer)

const WEDDING_ID = '11111111-1111-1111-1111-111111111111'
const USER_ID    = '22222222-2222-2222-2222-222222222222'

interface InsertedRow {
  file_name:    string
  storage_path: string
  size_bytes:   number
  mime_type:    string | null
  category:     string
  wedding_id:   string
  uploaded_by:  string
}

function buildSupabaseMock(options: {
  storedObjectName?:    string
  storedObjectSize?:    number
  insertError?:         { message: string } | null
}) {
  const insertedRows: InsertedRow[] = []

  const storage = {
    from: vi.fn(() => ({
      list: vi.fn().mockResolvedValue({
        data: options.storedObjectName
          ? [{ name: options.storedObjectName, metadata: { size: options.storedObjectSize ?? 1024 } }]
          : [],
        error: null,
      }),
    })),
  }

  const from = vi.fn((table: string) => {
    if (table !== 'wedding_files') throw new Error(`tabela não mockada no teste: ${table}`)
    return {
      insert: vi.fn((row: InsertedRow) => {
        insertedRows.push(row)
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data:  options.insertError ? null : { id: 'file-1', ...row, created_at: '2026-08-05T00:00:00.000Z' },
            error: options.insertError ?? null,
          }),
        }
      }),
    }
  })

  return { storage, from, insertedRows }
}

function buildRequest(body: unknown): Request {
  return new Request(`http://localhost/api/v1/weddings/${WEDDING_ID}/files`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

const baseBody = {
  file_name:    'contrato-buffet.pdf',
  storage_path: `${WEDDING_ID}/uuid-contrato-buffet.pdf`,
  size_bytes:   2048,
  mime_type:    'application/pdf',
}

describe('POST /api/v1/weddings/[wid]/files', () => {
  beforeEach(() => {
    mockedRequireAuth.mockReset()
    mockedRequireWeddingOwnership.mockReset()
    mockedRequireModuleAccess.mockReset()
    mockedCheckStorageLimit.mockReset()
    mockedCreateSupabaseServer.mockReset()

    mockedRequireAuth.mockResolvedValue({ user: { id: USER_ID } } as never)
    mockedRequireWeddingOwnership.mockResolvedValue(undefined)
    mockedRequireModuleAccess.mockResolvedValue(undefined)
    mockedCheckStorageLimit.mockResolvedValue({ allowed: true, current: 0, limit: 1_000_000, planId: 'free' } as never)
  })

  it('deve aceitar e gravar um upload com category "contrato"', async () => {
    const supabase = buildSupabaseMock({ storedObjectName: 'uuid-contrato-buffet.pdf', storedObjectSize: 2048 })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest({ ...baseBody, category: 'contrato' }), { params: Promise.resolve({ wid: WEDDING_ID }) })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.category).toBe('contrato')
    expect(supabase.insertedRows[0]?.category).toBe('contrato')
  })

  it('deve gravar category "geral" por padrão quando o campo não é enviado', async () => {
    const supabase = buildSupabaseMock({ storedObjectName: 'uuid-contrato-buffet.pdf', storedObjectSize: 2048 })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest(baseBody), { params: Promise.resolve({ wid: WEDDING_ID }) })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.category).toBe('geral')
  })

  it('deve rejeitar categoria inválida (fora de "geral"/"contrato") com 400, sem gravar nada', async () => {
    const supabase = buildSupabaseMock({ storedObjectName: 'uuid-contrato-buffet.pdf', storedObjectSize: 2048 })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest({ ...baseBody, category: 'assinado' }), { params: Promise.resolve({ wid: WEDDING_ID }) })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(supabase.insertedRows).toHaveLength(0)
  })
})
