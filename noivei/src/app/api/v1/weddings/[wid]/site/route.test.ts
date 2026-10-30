import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/api/guards/ownership', () => ({ requireWeddingOwnership: vi.fn(), requireModuleAccess: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }))
vi.mock('@/lib/billing/check-limit', () => ({ resolveWeddingPlanId: vi.fn() }))
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { EXCLUSIVE_SITE_TEMPLATES } from '@/lib/site/templates'
import { PATCH } from './route'

const context = { params: Promise.resolve({ wid: 'wedding-1' }) }
function request(template: string) { return new Request('https://example.com/api/v1/weddings/wedding-1/site', { method: 'PATCH', body: JSON.stringify({ template }) }) }
describe('restrição de estilos na API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: 'owner' } } as never)
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'site-1' }, error: null }), update: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'site-1' }, error: null }) }
    vi.mocked(createSupabaseServer).mockResolvedValue({ from: vi.fn(() => query) } as never)
  })
  it.each(['free', 'premium_monthly', 'premium_once'] as const)('nega todos os novos modelos no plano %s', async (plan) => {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue(plan)
    for (const template of EXCLUSIVE_SITE_TEMPLATES) {
      const response = await PATCH(request(template), context)
      expect(response.status).toBe(403)
      expect((await response.json()).error.code).toBe('TEMPLATE_NOT_AVAILABLE')
    }
  })
  it.each(['premium_plus_monthly', 'premium_plus_once'] as const)('permite todos os novos modelos no plano %s', async (plan) => {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue(plan)
    for (const template of EXCLUSIVE_SITE_TEMPLATES) expect((await PATCH(request(template), context)).status).toBe(200)
  })
})


describe('conteúdo validado pelo estilo salvo', () => {
  const photos = Array.from({ length: 9 }, (_, n) => 'https://example.com/' + n + '.jpg')
  function setup(existingContent: Record<string, unknown> = {}) {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: 'owner' } } as never)
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'site-1', template: 'editorial', content: existingContent }, error: null }), update: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'site-1' }, error: null }) }
    vi.mocked(createSupabaseServer).mockResolvedValue({ from: vi.fn(() => query) } as never)
    return query
  }
  function contentRequest(content: Record<string, unknown>) { return new Request('https://example.com/api/site', { method: 'PATCH', body: JSON.stringify({ content }) }) }
  it('nega fotos acima do limite mesmo sem reenviar template no PATCH', async () => {
    const query = setup()
    const res = await PATCH(contentRequest({ gallery_urls: photos }), context)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_TEMPLATE_CONTENT')
    expect(query.update).not.toHaveBeenCalled()
  })
  it('mantém fotos antigas ao editar textos após trocar de modelo', async () => {
    const query = setup({ gallery_urls: photos })
    expect((await PATCH(contentRequest({ gallery_urls: photos, hero_subtitle: 'Nosso dia' }), context)).status).toBe(200)
    expect(query.update).toHaveBeenCalled()
  })
  it('nega campos de envelope em modelos que não os oferecem', async () => {
    const query = setup()
    expect((await PATCH(contentRequest({ opening_hint: 'Abrir' }), context)).status).toBe(400)
    expect(query.update).not.toHaveBeenCalled()
  })
})
