// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/api/guards/vendor', () => ({ requireVendorProfile: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: vi.fn() }))
import { requireAuth } from '@/lib/auth/require-auth'
import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { createSupabaseServer } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { POST, DELETE } from './route'
function setup(dbError: unknown = null) {
  const storage = { upload: vi.fn().mockResolvedValue({ error: null }), remove: vi.fn().mockResolvedValue({ error: null }) }
  const eq = vi.fn().mockResolvedValue({ error: dbError })
  const update = vi.fn().mockReturnValue({ eq })
  vi.mocked(createSupabaseServer).mockResolvedValue({ storage: { from: vi.fn(() => storage) }, from: vi.fn(() => ({ update })) } as never)
  return { storage, eq, update }
}
function request(file: File) { const form = new FormData(); form.append('photo', file); return new Request('https://example.com/api/v1/vendor/avatar', { method: 'POST', body: form }) }
const png = () => new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'foto.png', { type: 'image/png' })
describe('upload da foto', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: 'owner' } } as never)
    vi.mocked(requireVendorProfile).mockResolvedValue({ id: 'vendor-1', slug: 'empresa', logo_storage_path: 'vendor-1/old.png' } as never)
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 19 })
  })
  it('grava somente no fornecedor autenticado e remove a foto anterior depois de salvar', async () => {
    const { storage, eq, update } = setup()
    expect((await POST(request(png()))).status).toBe(200)
    expect(storage.upload).toHaveBeenCalledWith(expect.stringMatching(/^vendor-1\/.+-avatar\.png$/), expect.any(Uint8Array), expect.any(Object))
    expect(eq).toHaveBeenCalledWith('id', 'vendor-1')
    expect(update).toHaveBeenCalledWith({ logo_storage_path: expect.any(String) })
    expect(storage.remove).toHaveBeenCalledWith(['vendor-1/old.png'])
  })
  it('rejeita arquivo com conteúdo incompatível sem gravar no storage', async () => {
    const { storage } = setup()
    expect((await POST(request(new File(['<svg/>'], 'foto.png', { type: 'image/png' })))).status).toBe(400)
    expect(storage.upload).not.toHaveBeenCalled()
  })
  it('limpa o novo arquivo se falhar ao salvar o perfil, preservando a foto anterior', async () => {
    const { storage } = setup({ code: 'DB_ERROR' })
    expect((await POST(request(png()))).status).toBe(500)
    expect(storage.remove).toHaveBeenCalledWith([expect.stringMatching(/-avatar\.png$/)])
    expect(storage.remove).not.toHaveBeenCalledWith(['vendor-1/old.png'])
  })
  it('nunca apaga um caminho de outra conta', async () => {
    const { storage } = setup()
    vi.mocked(requireVendorProfile).mockResolvedValue({ id: 'vendor-1', slug: 'empresa', logo_storage_path: 'other/foto.png' } as never)
    expect((await DELETE()).status).toBe(200)
    expect(storage.remove).not.toHaveBeenCalled()
  })
})
