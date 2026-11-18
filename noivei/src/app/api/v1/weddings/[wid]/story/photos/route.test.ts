import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/api/guards/ownership', () => ({ requireWeddingOwnership: vi.fn(), requireModuleAccess: vi.fn() }))
vi.mock('@/lib/billing/check-limit', () => ({ checkStorageLimit: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }))

import { requireModuleAccess } from '@/lib/api/guards/ownership'
import { ApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkStorageLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { POST } from './route'
import { DELETE } from './[id]/route'

const WID = '11111111-1111-4111-8111-111111111111'
const OTHER_WID = '22222222-2222-4222-8222-222222222222'
const MOMENT_ID = '33333333-3333-4333-8333-333333333333'
const PHOTO_ID = '44444444-4444-4444-8444-444444444444'
const PATH = `${WID}/abc-foto.jpg`

// Builder encadeável: qualquer método devolve o próprio builder; maybeSingle/single resolvem `result`.
function chain(result: unknown) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'update', 'delete', 'insert']) {
    builder[method] = vi.fn(() => builder)
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  builder.single = vi.fn(() => Promise.resolve(result))
  return builder
}

interface Setup {
  stored?:      { size: number; mimetype: string } | null
  moment?:      unknown
  rpc?:         { data: unknown; error: unknown }
  galleryRow?:  unknown
  removeError?: unknown
}

function setup({ stored = { size: 1000, mimetype: 'image/jpeg' }, moment = { id: MOMENT_ID }, rpc = { data: PHOTO_ID, error: null }, galleryRow = { storage_path: PATH }, removeError = null }: Setup = {}) {
  const remove = vi.fn().mockResolvedValue({ error: removeError })
  const deleteChain = chain({ data: { id: PHOTO_ID }, error: null })
  const fromCalls: string[] = []
  let galleryCalls = 0

  const supabase = {
    rpc: vi.fn().mockResolvedValue(rpc),
    storage: {
      from: vi.fn(() => ({
        list: vi.fn().mockResolvedValue({ data: stored ? [{ name: 'abc-foto.jpg', metadata: stored }] : [], error: null }),
        remove,
        getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } })),
      })),
    },
    from: vi.fn((table: string) => {
      fromCalls.push(table)
      if (table === 'site_story_moments') return chain({ data: moment, error: null })
      if (table === 'site_story_photos') return chain({ data: { sort_order: 3 }, error: null })
      if (table === 'wedding_gallery_photos') {
        galleryCalls += 1
        return galleryCalls === 1 ? chain({ data: galleryRow, error: null }) : deleteChain
      }
      throw new Error(`tabela inesperada: ${table}`)
    }),
  }
  vi.mocked(createSupabaseServer).mockResolvedValue(supabase as never)
  return { supabase, remove, deleteChain, fromCalls }
}

function postRequest(body: Record<string, unknown>) {
  return new Request(`http://test/api/v1/weddings/${WID}/story/photos`, { method: 'POST', body: JSON.stringify(body) })
}

const validBody = { storage_path: PATH, size_bytes: 1000, mime_type: 'image/jpeg', width: 1600, height: 1200 }
const ctx = { params: Promise.resolve({ wid: WID }) }

describe('POST /story/photos', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    vi.mocked(checkStorageLimit).mockResolvedValue({ allowed: true, current: 0, limit: 100 } as never)
  })

  it('deve registrar a foto via RPC atômica e devolver 201', async () => {
    const { supabase, remove } = setup()
    const res = await POST(postRequest({ ...validBody, moment_id: MOMENT_ID, caption: '  Praia ' }), ctx)
    expect(res.status).toBe(201)
    expect(supabase.rpc).toHaveBeenCalledWith('fn_add_site_story_photo', expect.objectContaining({
      p_wedding_id: WID, p_storage_path: PATH, p_moment_id: MOMENT_ID, p_caption: 'Praia', p_size_bytes: 1000,
    }))
    expect(remove).not.toHaveBeenCalled()
  })

  it('deve recusar path de outro casamento sem tocar no Storage', async () => {
    const { supabase } = setup()
    const res = await POST(postRequest({ ...validBody, storage_path: `${OTHER_WID}/x.jpg` }), ctx)
    expect(res.status).toBe(400)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('deve recusar path com subpastas ou travessia', async () => {
    setup()
    expect((await POST(postRequest({ ...validBody, storage_path: `${WID}/../${OTHER_WID}/x.jpg` }), ctx)).status).toBe(400)
  })

  it('deve usar o tipo real gravado e descartar arquivo que não é imagem permitida', async () => {
    const { remove, supabase } = setup({ stored: { size: 1000, mimetype: 'image/heic' } })
    const res = await POST(postRequest(validBody), ctx)
    expect(res.status).toBe(400)
    expect(remove).toHaveBeenCalledWith([PATH])
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('deve descartar e recusar momento de outro casamento', async () => {
    const { remove } = setup({ moment: null })
    const res = await POST(postRequest({ ...validBody, moment_id: MOMENT_ID }), ctx)
    expect(res.status).toBe(400)
    expect(remove).toHaveBeenCalledWith([PATH])
  })

  it('deve descartar quando a cota do plano estoura, conferindo o tamanho real', async () => {
    const { remove } = setup({ stored: { size: 5000, mimetype: 'image/webp' } })
    vi.mocked(checkStorageLimit).mockResolvedValue({ allowed: false, current: 100, limit: 100 } as never)
    const res = await POST(postRequest(validBody), ctx)
    expect(res.status).toBe(403)
    expect(checkStorageLimit).toHaveBeenCalledWith(expect.anything(), WID, 5000)
    expect(remove).toHaveBeenCalledWith([PATH])
  })

  it('deve traduzir o teto de 24 fotos do banco em 409 e descartar o arquivo', async () => {
    const { remove } = setup({ rpc: { data: null, error: { code: 'P0001', hint: 'STORY_PHOTO_LIMIT' } } })
    const res = await POST(postRequest(validBody), ctx)
    expect(res.status).toBe(409)
    expect(remove).toHaveBeenCalledWith([PATH])
  })

  it('deve recusar quando o objeto não existe no Storage', async () => {
    setup({ stored: null })
    expect((await POST(postRequest(validBody), ctx)).status).toBe(400)
  })

  it('deve recusar quem não tem acesso ao módulo site', async () => {
    setup()
    vi.mocked(requireModuleAccess).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Sem acesso'))
    expect((await POST(postRequest(validBody), ctx)).status).toBe(403)
  })
})

describe('DELETE /story/photos/[id]', () => {
  const deleteCtx = { params: Promise.resolve({ wid: WID, id: PHOTO_ID }) }
  const deleteRequest = () => new Request('http://test', { method: 'DELETE' })

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: 'user-1' } } as never)
  })

  it('deve remover do Storage antes do banco', async () => {
    const { remove, deleteChain } = setup()
    const res = await DELETE(deleteRequest(), deleteCtx)
    expect(res.status).toBe(200)
    expect(remove).toHaveBeenCalledWith([PATH])
    expect(deleteChain.delete).toHaveBeenCalled()
  })

  it('deve manter o registro quando o Storage falha', async () => {
    const { deleteChain } = setup({ removeError: { message: 'falhou' } })
    const res = await DELETE(deleteRequest(), deleteCtx)
    expect(res.status).toBe(500)
    expect(deleteChain.delete).not.toHaveBeenCalled()
  })

  it('deve tentar de novo quando o banco falha depois de o arquivo já ter saído do Storage', async () => {
    const { deleteChain } = setup()
    vi.mocked(deleteChain.maybeSingle as () => Promise<unknown>)
      .mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })
    const res = await DELETE(deleteRequest(), deleteCtx)
    expect(res.status).toBe(200)
    expect(deleteChain.delete).toHaveBeenCalledTimes(2)
  })

  it('deve responder PHOTO_DELETE_INCOMPLETE quando o banco falha duas vezes, para o casal repetir', async () => {
    const { deleteChain } = setup()
    vi.mocked(deleteChain.maybeSingle as () => Promise<unknown>)
      .mockResolvedValue({ data: null, error: { message: 'timeout' } })
    const res = await DELETE(deleteRequest(), deleteCtx)
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('PHOTO_DELETE_INCOMPLETE')
  })

  it('deve concluir a exclusão repetida quando o arquivo já não existe no Storage', async () => {
    // remove() de objeto inexistente devolve data: [] e error: null no Storage.
    const { remove } = setup({ removeError: null })
    remove.mockResolvedValue({ data: [], error: null })
    expect((await DELETE(deleteRequest(), deleteCtx)).status).toBe(200)
  })

  it('deve devolver 404 para foto que não é da história deste casamento', async () => {
    const { remove } = setup({ galleryRow: null })
    expect((await DELETE(deleteRequest(), deleteCtx)).status).toBe(404)
    expect(remove).not.toHaveBeenCalled()
  })
})
