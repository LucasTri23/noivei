import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/api/guards/ownership', () => ({ requireWeddingOwnership: vi.fn(), requireModuleAccess: vi.fn() }))
vi.mock('@/lib/billing/check-limit', () => ({ checkStorageLimit: vi.fn(), resolveWeddingPlanId: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }))

import { requireAuth } from '@/lib/auth/require-auth'
import { checkStorageLimit, resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { DELETE, GET, POST } from './route'

const WID = '11111111-1111-4111-8111-111111111111'
const PATH = `${WID}/abc-monograma.webp`
const ctx = { params: Promise.resolve({ wid: WID }) }

function chain(result: unknown) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'delete']) builder[method] = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (resolve: (value: unknown) => void) => resolve(result)
  return builder
}

function setup({ stored = { size: 40_000, mimetype: 'image/webp' }, template = 'editorial', galleryCount = 0 } = {}) {
  const remove = vi.fn().mockResolvedValue({ error: null })
  const insertChain = chain({ data: { id: 'p1', storage_path: PATH, size_bytes: stored.size, purpose: 'brand' }, error: null })
  const countChain = chain({ count: galleryCount, error: null })
  const siteChain = chain({ data: { template }, error: null })
  // select() = contagem do teto (só fotos de galeria); insert() = registro da foto.
  const galleryTable = { select: countChain.select, insert: insertChain.insert }
  const supabase = {
    storage: {
      from: vi.fn(() => ({
        list: vi.fn().mockResolvedValue({ data: [{ name: 'abc-monograma.webp', metadata: stored }], error: null }),
        remove,
        getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } })),
      })),
    },
    from: vi.fn((table: string) => (table === 'site_config' ? siteChain : galleryTable)),
  }
  vi.mocked(createSupabaseServer).mockResolvedValue(supabase as never)
  return { remove, insertChain, countChain }
}

const post = (body: Record<string, unknown>) => POST(new Request('http://test', { method: 'POST', body: JSON.stringify(body) }), ctx)
const brandBody = { storage_path: PATH, size_bytes: 40_000, mime_type: 'image/webp', purpose: 'brand' }

describe('POST /gallery-photos com purpose brand (monograma)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    vi.mocked(checkStorageLimit).mockResolvedValue({ allowed: true, current: 0, limit: 100 } as never)
    vi.mocked(resolveWeddingPlanId).mockResolvedValue('premium_monthly')
  })

  it('deve registrar como brand sem contar no teto de fotos do estilo', async () => {
    const { insertChain, countChain } = setup({ galleryCount: 999 })
    const res = await post(brandBody)
    expect(res.status).toBe(201)
    expect(countChain.select).not.toHaveBeenCalled()
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'brand', wedding_id: WID }))
  })

  it('deve recusar no plano Gratuito', async () => {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue('free')
    setup()
    expect((await post(brandBody)).status).toBe(403)
  })

  it('deve recusar e apagar SVG ou arquivo acima de 2 MB, conferindo o arquivo real', async () => {
    const svg = setup({ stored: { size: 2_000, mimetype: 'image/svg+xml' } })
    expect((await post({ ...brandBody, mime_type: 'image/png' })).status).toBe(400)
    expect(svg.remove).toHaveBeenCalledWith([PATH])

    const big = setup({ stored: { size: 3 * 1024 * 1024, mimetype: 'image/png' } })
    expect((await post({ ...brandBody, size_bytes: 10 })).status).toBe(400)
    expect(big.remove).toHaveBeenCalledWith([PATH])
  })

  it('deve continuar aplicando o teto do estilo às fotos de galeria', async () => {
    setup({ galleryCount: 8 })
    const res = await post({ storage_path: PATH, size_bytes: 40_000, mime_type: 'image/webp' })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('GALLERY_LIMIT_REACHED')
  })

  it('deve recusar purpose story por esta rota (história tem rota própria)', async () => {
    setup()
    expect((await post({ ...brandBody, purpose: 'story' })).status).toBe(400)
  })
})

describe('GET e DELETE incluem o monograma, nunca fotos da história', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: 'user-1' } } as never)
  })

  it('GET filtra por gallery e brand', async () => {
    const list = chain({ data: [], error: null })
    vi.mocked(createSupabaseServer).mockResolvedValue({ from: vi.fn(() => list), storage: { from: vi.fn() } } as never)
    await GET(new Request('http://test'), ctx)
    expect(list.in).toHaveBeenCalledWith('purpose', ['gallery', 'brand'])
  })

  it('DELETE localiza o registro só entre gallery e brand', async () => {
    const found = chain({ data: { storage_path: PATH }, error: null })
    const removed = chain({ data: { id: 'p1' }, error: null })
    let calls = 0
    vi.mocked(createSupabaseServer).mockResolvedValue({
      from: vi.fn(() => (++calls === 1 ? found : removed)),
      storage: { from: vi.fn(() => ({ remove: vi.fn().mockResolvedValue({ error: null }) })) },
    } as never)
    const res = await DELETE(new Request(`http://test?storage_path=${encodeURIComponent(PATH)}`, { method: 'DELETE' }), ctx)
    expect(res.status).toBe(200)
    expect(found.in).toHaveBeenCalledWith('purpose', ['gallery', 'brand'])
    expect(removed.in).toHaveBeenCalledWith('purpose', ['gallery', 'brand'])
  })
})
