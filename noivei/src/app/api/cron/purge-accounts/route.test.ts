import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted para o topo do arquivo — o factory não pode referenciar
// variáveis externas, só vi.fn() puro. A configuração de retorno de cada teste
// é feita via createSupabaseService (importado como mock abaixo) + mockReturnValue.
vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: vi.fn(),
}))

import { createSupabaseService } from '@/lib/supabase/service'
import { GET } from './route'

const mockedCreateSupabaseService = vi.mocked(createSupabaseService)

const CRON_SECRET = 'test-cron-secret'

type ListResult = { data: { name: string }[] | null; error: { message: string } | null }
type RemoveResult = { error: { message: string } | null }

interface StorageMock {
  from: ReturnType<typeof vi.fn>
  listCalls: { bucket: string; path: string; options: unknown }[]
  removeCalls: { bucket: string; paths: string[] }[]
}

function buildStorageMock(
  listResults: Record<string, ListResult> = {},
  removeResults: Record<string, RemoveResult> = {},
): StorageMock {
  const listCalls: { bucket: string; path: string; options: unknown }[] = []
  const removeCalls: { bucket: string; paths: string[] }[] = []

  const from = vi.fn((bucket: string) => ({
    list: vi.fn((path: string, options: unknown) => {
      listCalls.push({ bucket, path, options })
      return Promise.resolve(listResults[bucket] ?? { data: [], error: null })
    }),
    remove: vi.fn((paths: string[]) => {
      removeCalls.push({ bucket, paths })
      return Promise.resolve(removeResults[bucket] ?? { error: null })
    }),
  }))

  return { from, listCalls, removeCalls }
}

function buildSupabaseMock(options: {
  weddings: { id: string }[]
  weddingsError?: { message: string } | null
  listResults?: Record<string, ListResult>
  removeResults?: Record<string, RemoveResult>
  rpcError?: { message: string } | null
}) {
  const storage = buildStorageMock(options.listResults, options.removeResults)
  const rpc = vi.fn().mockResolvedValue({ error: options.rpcError ?? null })

  const weddingsQuery = {
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    lt: vi.fn().mockResolvedValue({ data: options.weddings, error: options.weddingsError ?? null }),
  }

  const from = vi.fn((table: string) => {
    if (table === 'weddings') return weddingsQuery
    throw new Error(`tabela não mockada no teste: ${table}`)
  })

  return { from, storage, rpc }
}

function buildRequest(secret = CRON_SECRET): Request {
  return new Request('http://localhost/api/cron/purge-accounts', {
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('GET /api/cron/purge-accounts', () => {
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET
    mockedCreateSupabaseService.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret
    vi.restoreAllMocks()
  })

  it('deve varrer os 4 buckets de Storage (incluindo wedding-album-photos) para cada casamento expurgado', async () => {
    const weddingId = 'wedding-1'
    const supabase = buildSupabaseMock({ weddings: [{ id: weddingId }] })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const response = await GET(buildRequest())

    expect(response.status).toBe(200)
    const bucketsVarridos = supabase.storage.from.mock.calls.map((call) => call[0])
    expect(bucketsVarridos).toEqual(
      expect.arrayContaining(['wedding-files', 'wedding-photos', 'wedding-gift-photos', 'wedding-album-photos']),
    )
    expect(bucketsVarridos).toHaveLength(4)
    expect(supabase.rpc).toHaveBeenCalledWith('fn_purge_soft_deleted_accounts')
  })

  it('deve tratar bucket vazio sem gerar erro', async () => {
    const weddingId = 'wedding-2'
    const supabase = buildSupabaseMock({
      weddings: [{ id: weddingId }],
      listResults: {
        'wedding-album-photos': { data: [], error: null },
      },
    })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.filesRemoved).toBe(0)
    expect(console.error).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledWith('fn_purge_soft_deleted_accounts')
  })

  it('deve continuar limpando os demais buckets e expurgar o banco quando um bucket falha', async () => {
    const weddingId = 'wedding-3'
    const supabase = buildSupabaseMock({
      weddings: [{ id: weddingId }],
      listResults: {
        'wedding-album-photos': { data: null, error: { message: 'falha simulada de rede' } },
        'wedding-gift-photos': { data: [{ name: 'foto.png' }], error: null },
      },
    })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    // O bucket com falha não deve ter tido remove() chamado, mas os outros 3 sim.
    const bucketsVarridos = new Set(supabase.storage.from.mock.calls.map((call) => call[0]))
    expect(bucketsVarridos.size).toBe(4)
    expect(supabase.storage.removeCalls.some((c) => c.bucket === 'wedding-gift-photos')).toBe(true)
    expect(supabase.storage.removeCalls.some((c) => c.bucket === 'wedding-album-photos')).toBe(false)
    expect(body.data.filesRemoved).toBe(1)
    // Erro registrado com contexto (bucket + wedding_id), sem expor segredos.
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('wedding-album-photos'),
      expect.anything(),
    )
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(weddingId), expect.anything())
    // Falha em um bucket não pode impedir o expurgo definitivo do banco.
    expect(supabase.rpc).toHaveBeenCalledWith('fn_purge_soft_deleted_accounts')
  })

  it('deve continuar limpando os demais buckets quando a remoção falha em um bucket específico', async () => {
    const weddingId = 'wedding-4'
    const supabase = buildSupabaseMock({
      weddings: [{ id: weddingId }],
      listResults: {
        'wedding-files': { data: [{ name: 'contrato.pdf' }], error: null },
        'wedding-album-photos': { data: [{ name: 'foto-convidado.jpg' }], error: null },
      },
      removeResults: {
        'wedding-album-photos': { error: { message: 'falha simulada ao remover' } },
      },
    })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.filesRemoved).toBe(1) // só wedding-files contou, wedding-album-photos falhou
    expect(supabase.rpc).toHaveBeenCalledWith('fn_purge_soft_deleted_accounts')
  })

  it('deve listar e remover usando o prefixo exato do wedding_id, nunca uma varredura geral do bucket', async () => {
    const weddingId = 'wedding-5-abc'
    const supabase = buildSupabaseMock({
      weddings: [{ id: weddingId }],
      listResults: {
        'wedding-album-photos': { data: [{ name: 'foto-1.jpg' }], error: null },
      },
    })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    await GET(buildRequest())

    const albumListCalls = supabase.storage.listCalls.filter((c) => c.bucket === 'wedding-album-photos')
    expect(albumListCalls).toHaveLength(1)
    expect(albumListCalls[0]?.path).toBe(weddingId)

    const albumRemoveCalls = supabase.storage.removeCalls.filter((c) => c.bucket === 'wedding-album-photos')
    expect(albumRemoveCalls).toHaveLength(1)
    expect(albumRemoveCalls[0]?.paths).toEqual([`${weddingId}/foto-1.jpg`])
  })

  it('deve isolar casamentos diferentes: nunca remover arquivo de outro wedding_id', async () => {
    const weddingA = 'wedding-a'
    const weddingB = 'wedding-b'
    const supabase = buildSupabaseMock({
      weddings: [{ id: weddingA }, { id: weddingB }],
      listResults: {
        'wedding-album-photos': { data: [{ name: 'foto.jpg' }], error: null },
      },
    })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    await GET(buildRequest())

    const albumRemoveCalls = supabase.storage.removeCalls.filter((c) => c.bucket === 'wedding-album-photos')
    expect(albumRemoveCalls).toHaveLength(2)

    const callForA = albumRemoveCalls.find((c) => c.paths[0]?.startsWith(`${weddingA}/`))
    const callForB = albumRemoveCalls.find((c) => c.paths[0]?.startsWith(`${weddingB}/`))

    // Cada remoção só contém paths do próprio wedding_id — nunca mistura os dois.
    expect(callForA?.paths).toEqual([`${weddingA}/foto.jpg`])
    expect(callForB?.paths).toEqual([`${weddingB}/foto.jpg`])
  })

  it('deve rejeitar requisição sem o CRON_SECRET correto', async () => {
    const supabase = buildSupabaseMock({ weddings: [] })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const response = await GET(buildRequest('secret-errado'))

    expect(response.status).toBe(401)
    expect(supabase.storage.from).not.toHaveBeenCalled()
  })
})
