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
  it.each(['free', 'premium_monthly', 'premium_once'] as const)('nega os convites com selo no plano %s', async (plan) => {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue(plan)
    for (const template of EXCLUSIVE_SITE_TEMPLATES) {
      const response = await PATCH(request(template), context)
      expect(response.status).toBe(403)
      expect((await response.json()).error.code).toBe('TEMPLATE_NOT_AVAILABLE')
    }
  })
  it.each(['free', 'premium_monthly', 'premium_once'] as const)('permite os estilos do plano %s', async (plan) => {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue(plan)
    expect((await PATCH(request('photographic'), context)).status).toBe(200)
    for (const template of ['portfolio', 'editorial', 'garden']) {
      expect((await PATCH(request(template), context)).status).toBe(plan === 'free' ? 403 : 200)
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
    vi.mocked(resolveWeddingPlanId).mockResolvedValue('premium_monthly')
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
  it.each(['free', 'premium_monthly', 'premium_plus_once'] as const)('valida o monograma no plano %s', async (plan) => {
    setup()
    vi.mocked(resolveWeddingPlanId).mockResolvedValue(plan)
    expect((await PATCH(contentRequest({ envelope_monogram: 'A & J' }), context)).status).toBe(plan === 'free' ? 403 : 200)
  })
  it('nega campos de envelope em modelos que não os oferecem', async () => {
    const query = setup()
    expect((await PATCH(contentRequest({ opening_hint: 'Abrir' }), context)).status).toBe(400)
    expect(query.update).not.toHaveBeenCalled()
  })
})

describe('personalização do site na API', () => {
  const WID = 'wedding-1'
  const ownUrl = `https://proj.supabase.co/storage/v1/object/public/wedding-photos/${WID}/monograma.webp`

  function setup(plan: 'free' | 'premium_monthly', existingContent: Record<string, unknown> = {}, brandRow: unknown = { id: 'brand-1' }) {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue(plan)
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: 'owner' } } as never)
    const siteQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'site-1', template: 'classic', content: existingContent }, error: null }), update: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'site-1' }, error: null }) }
    const photoQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: brandRow, error: null }) }
    vi.mocked(createSupabaseServer).mockResolvedValue({ from: vi.fn((table: string) => (table === 'wedding_gallery_photos' ? photoQuery : siteQuery)) } as never)
    return { siteQuery, photoQuery }
  }
  const patch = (content: Record<string, unknown>) => PATCH(new Request('https://example.com/api/site', { method: 'PATCH', body: JSON.stringify({ content }) }), { params: Promise.resolve({ wid: WID }) })

  it.each([
    [{ font_pair: 'elegante' }],
    [{ palette: { tone: 'dark' } }],
    [{ palette: { seal: 'wax' } }],
    [{ lodging: [{ name: 'Hotel' }] }],
    [{ monogram_image_url: ownUrl }],
  ])('deve bloquear recurso pago no Gratuito: %j', async (content) => {
    const { siteQuery } = setup('free')
    const res = await patch(content)
    expect(res.status).toBe(403)
    expect(siteQuery.update).not.toHaveBeenCalled()
  })

  it('deve liberar cor de destaque, seções e perguntas no Gratuito', async () => {
    setup('free')
    expect((await patch({
      palette: { accent: '#7A2E3B' }, sections: { order: ['faq'], hidden: ['mural'] }, faq: [{ question: 'Tem estacionamento?', answer: 'Sim.' }],
    })).status).toBe(200)
  })

  it('deve deixar o Gratuito salvar textos mantendo recursos pagos já salvos antes do downgrade', async () => {
    const saved = { font_pair: 'elegante', lodging: [{ name: 'Hotel' }] }
    setup('free', saved)
    expect((await patch({ ...saved, our_story: 'Texto novo' })).status).toBe(200)
  })

  it('deve aceitar imagem de monograma enviada por este casamento como brand', async () => {
    const { photoQuery } = setup('premium_monthly')
    expect((await patch({ monogram_image_url: ownUrl })).status).toBe(200)
    expect(photoQuery.eq).toHaveBeenCalledWith('purpose', 'brand')
    expect(photoQuery.eq).toHaveBeenCalledWith('storage_path', `${WID}/monograma.webp`)
  })

  it.each([
    'https://evil.test/monograma.png',
    'https://proj.supabase.co/storage/v1/object/public/wedding-photos/outro-casamento/monograma.webp',
  ])('deve recusar imagem de monograma que não é deste casamento: %s', async (url) => {
    const { siteQuery, photoQuery } = setup('premium_monthly')
    expect((await patch({ monogram_image_url: url })).status).toBe(400)
    expect(photoQuery.maybeSingle).not.toHaveBeenCalled()
    expect(siteQuery.update).not.toHaveBeenCalled()
  })

  it('deve recusar imagem do próprio casamento que não foi registrada como monograma', async () => {
    setup('premium_monthly', {}, null)
    expect((await patch({ monogram_image_url: ownUrl })).status).toBe(400)
  })

  it('deve recusar link de mapa perigoso e mais de 8 perguntas', async () => {
    setup('premium_monthly')
    expect((await patch({ lodging: [{ name: 'Hotel', map_url: 'javascript:alert(1)' }] })).status).toBe(400)
    expect((await patch({ faq: Array.from({ length: 9 }, () => ({ question: 'P', answer: 'R' })) })).status).toBe(400)
  })
})
