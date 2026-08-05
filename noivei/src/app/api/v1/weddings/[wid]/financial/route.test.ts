import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — factories não podem referenciar variáveis externas, só vi.fn() puro.
// Mesmo padrão de mocking de src/app/api/cron/purge-accounts/route.test.ts.
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/api/guards/ownership', () => ({
  requireWeddingOwnership: vi.fn(),
  requireModuleAccess:     vi.fn(),
}))
vi.mock('@/lib/billing/check-limit', () => ({
  checkFinancialEntryLimit: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}))

import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkFinancialEntryLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { POST } from './route'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedRequireWeddingOwnership = vi.mocked(requireWeddingOwnership)
const mockedRequireModuleAccess = vi.mocked(requireModuleAccess)
const mockedCheckFinancialEntryLimit = vi.mocked(checkFinancialEntryLimit)
const mockedCreateSupabaseServer = vi.mocked(createSupabaseServer)

const WEDDING_A = '11111111-1111-1111-1111-111111111111'
const WEDDING_B = '99999999-9999-9999-9999-999999999999'
const USER_ID   = '22222222-2222-2222-2222-222222222222'
// UUID válido pro formato exigido pelo Zod (z.uuid() confere versão/variante nos nibbles) —
// diferente de WEDDING_A/B acima, que nunca passam por validação de formato Zod nesta rota
// (wid só é comparado como string, não validado como UUID aqui).
const FILE_ID = '33333333-3333-4333-8333-333333333333'

interface InsertedRow {
  category:         string
  attached_file_id?: string | null
  wedding_id:        string
  [key: string]: unknown
}

function buildSupabaseMock(options: {
  // Arquivo encontrado ao consultar wedding_files por id+wedding_id — undefined = nenhuma linha
  attachedFileRow?: { id: string } | null
  insertError?:     { message: string } | null
}) {
  const insertedRows: InsertedRow[] = []
  let lastWeddingFilesFilter: { id?: string; wedding_id?: string } = {}

  const from = vi.fn((table: string) => {
    if (table === 'wedding_files') {
      const filter: { id?: string; wedding_id?: string } = {}
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((column: string, value: string) => {
          filter[column as 'id' | 'wedding_id'] = value
          lastWeddingFilesFilter = filter
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((column2: string, value2: string) => {
              filter[column2 as 'id' | 'wedding_id'] = value2
              lastWeddingFilesFilter = filter
              return {
                maybeSingle: vi.fn().mockResolvedValue({
                  data: options.attachedFileRow ?? null,
                  error: null,
                }),
              }
            }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: options.attachedFileRow ?? null,
              error: null,
            }),
          }
        }),
      }
    }

    if (table === 'financial_entries') {
      return {
        insert: vi.fn((row: InsertedRow) => {
          insertedRows.push(row)
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data:  options.insertError ? null : { id: 'entry-1', ...row, created_at: '2026-08-05T00:00:00.000Z' },
              error: options.insertError ?? null,
            }),
          }
        }),
      }
    }

    throw new Error(`tabela não mockada no teste: ${table}`)
  })

  return { from, insertedRows, get lastWeddingFilesFilter() { return lastWeddingFilesFilter } }
}

function buildRequest(weddingId: string, body: unknown): Request {
  return new Request(`http://localhost/api/v1/weddings/${weddingId}/financial`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

const baseBody = {
  category:     'Espaço & Buffet',
  description:  'Sinal do buffet',
  total_amount: 10000,
  paid_amount:  0,
}

describe('POST /api/v1/weddings/[wid]/financial', () => {
  beforeEach(() => {
    mockedRequireAuth.mockReset()
    mockedRequireWeddingOwnership.mockReset()
    mockedRequireModuleAccess.mockReset()
    mockedCheckFinancialEntryLimit.mockReset()
    mockedCreateSupabaseServer.mockReset()

    mockedRequireAuth.mockResolvedValue({ user: { id: USER_ID } } as never)
    mockedRequireWeddingOwnership.mockResolvedValue(undefined)
    mockedRequireModuleAccess.mockResolvedValue(undefined)
    mockedCheckFinancialEntryLimit.mockResolvedValue({ allowed: true, current: 0, limit: 15, planId: 'free' } as never)
  })

  it('deve criar o lançamento normalmente quando nenhum anexo é enviado', async () => {
    const supabase = buildSupabaseMock({})
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest(WEDDING_A, baseBody), { params: Promise.resolve({ wid: WEDDING_A }) })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.attached_file_id).toBeUndefined()
    expect(supabase.insertedRows).toHaveLength(1)
    expect(supabase.insertedRows[0]?.attached_file_id).toBeUndefined()
  })

  it('deve vincular o attached_file_id quando o arquivo pertence ao MESMO wedding_id', async () => {
    const supabase = buildSupabaseMock({ attachedFileRow: { id: FILE_ID } })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(
      buildRequest(WEDDING_A, { ...baseBody, attached_file_id: FILE_ID }),
      { params: Promise.resolve({ wid: WEDDING_A }) },
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.attached_file_id).toBe(FILE_ID)
    expect(supabase.lastWeddingFilesFilter).toEqual({ id: FILE_ID, wedding_id: WEDDING_A })
  })

  it('deve rejeitar attached_file_id de um arquivo de OUTRO casamento, sem criar o lançamento', async () => {
    // A query filtra por id + wedding_id do PRÓPRIO casamento (WEDDING_A) — um arquivo que só
    // existe sob WEDDING_B nunca bate nesse filtro, então o mock retorna null (nenhuma linha),
    // simulando exatamente esse cenário sem precisar simular dois casamentos no mock.
    const supabase = buildSupabaseMock({ attachedFileRow: null })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(
      buildRequest(WEDDING_A, { ...baseBody, attached_file_id: FILE_ID }),
      { params: Promise.resolve({ wid: WEDDING_A }) },
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(supabase.insertedRows).toHaveLength(0)
    // Confirma que a checagem realmente restringiu a busca ao wedding_id do request (WEDDING_A),
    // nunca ao WEDDING_B de onde o id do arquivo poderia ter vindo.
    expect(supabase.lastWeddingFilesFilter).toEqual({ id: FILE_ID, wedding_id: WEDDING_A })
    expect(supabase.lastWeddingFilesFilter.wedding_id).not.toBe(WEDDING_B)
  })
})
