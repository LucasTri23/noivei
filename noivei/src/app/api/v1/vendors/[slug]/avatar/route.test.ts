// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createSupabaseService: vi.fn() }))
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'
import { GET } from './route'
const context = { params: Promise.resolve({ slug: 'empresa' }) }
describe('foto pública com acesso controlado', () => {
  beforeEach(() => vi.resetAllMocks())
  function setup(vendor: unknown) {
    vi.mocked(createSupabaseServer).mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: vendor, error: null }) })) } as never)
    const sign = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed-avatar' }, error: null })
    vi.mocked(createSupabaseService).mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl: sign })) } } as never)
    return sign
  }
  it('não assina foto se a RLS não permite ler o fornecedor', async () => {
    const sign = setup(null)
    expect((await GET(new Request('https://example.com'), context)).status).toBe(404)
    expect(sign).not.toHaveBeenCalled()
  })
  it('não assina caminho de outra conta mesmo que esteja salvo no perfil', async () => {
    const sign = setup({ id: 'vendor-1', logo_storage_path: 'vendor-2/photo.png' })
    expect((await GET(new Request('https://example.com'), context)).status).toBe(404)
    expect(sign).not.toHaveBeenCalled()
  })
  it('redireciona para foto autorizada com validade curta e sem cache público', async () => {
    const sign = setup({ id: 'vendor-1', logo_storage_path: 'vendor-1/photo.png' })
    const response = await GET(new Request('https://example.com'), context)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://example.com/signed-avatar')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(sign).toHaveBeenCalledWith('vendor-1/photo.png', 300)
  })
})
