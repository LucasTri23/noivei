import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
vi.mock('@/lib/billing/check-limit', () => ({ resolveWeddingPlanId: vi.fn() }))
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { getPublicSiteBySlug } from './get-public-site-by-slug'

function database(template: string, content: Record<string, unknown> = {}) {
  return { from: vi.fn((table: string) => {
    const data = table === 'site_config' ? { wedding_id: 'w1', template, content }
      : table === 'weddings' ? { couple_names: 'Ana & João', wedding_color: '#777c5a', wedding_color_secondary: '#a47859' }
      : table === 'plan_module_access' ? { enabled: true } : []
    const q = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }), order: vi.fn().mockReturnThis(), then: (resolve: (value: unknown) => void) => resolve({ data, error: null }) }
    return q
  }) } as unknown as SupabaseClient
}
describe('fallback público após downgrade', () => {
  beforeEach(() => vi.resetAllMocks())
  it.each(['free', 'premium_monthly'] as const)('aplica o acesso ao monograma no Fotográfico para %s', async (plan) => {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue(plan)
    const site = await getPublicSiteBySlug(database('photographic', { envelope_monogram: 'A & J' }), 'casal')
    expect(site?.template).toBe('photographic')
    expect(site?.content.envelope_monogram).toBe(plan === 'free' ? undefined : 'A & J')
  })
  it.each(['invitation', 'enveloped'])('renderiza Clássico para %s fora do Exclusivo', async (template) => {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue('premium_monthly')
    expect((await getPublicSiteBySlug(database(template), 'casal'))?.template).toBe('classic')
  })
  it.each(['editorial', 'garden', 'portfolio'])('preserva %s no Ideal', async (template) => {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue('premium_monthly')
    expect((await getPublicSiteBySlug(database(template), 'casal'))?.template).toBe(template)
  })
  it.each(['editorial', 'garden', 'invitation', 'enveloped'])('preserva %s com plano Exclusivo ativo', async (template) => {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue('premium_plus_once')
    expect((await getPublicSiteBySlug(database(template), 'casal'))?.template).toBe(template)
  })
})

describe('Nossa História no site público', () => {
  const STORY_URL = 'https://cdn.test/w1/story.jpg'
  const GALLERY_URL = 'https://cdn.test/w1/gallery.jpg'

  function storyDatabase(content: Record<string, unknown>) {
    const tables: string[] = []
    const rows: Record<string, unknown> = {
      site_config:            { wedding_id: 'w1', template: 'classic', content },
      weddings:               { couple_names: 'Ana & João', wedding_color: '#777c5a', wedding_color_secondary: '#a47859' },
      plan_module_access:     { enabled: true },
      gift_registry_items:    [],
      site_story_moments:     [{ id: 'm1', title: 'Encontro', description: null, happened_on: '2018-03-02', date_precision: 'month', sort_order: 0 }],
      site_story_photos:      [{ photo_id: 'p1', moment_id: 'm1', caption: null, sort_order: 0 }],
    }
    const supabase = {
      storage: { from: vi.fn(() => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }) })) },
      from: vi.fn((table: string) => {
        tables.push(table)
        // wedding_gallery_photos: lista do loader da galeria (sem filtro de purpose) e do loader da história.
        const data = table === 'wedding_gallery_photos'
          ? [
              { id: 'p1', storage_path: 'w1/story.jpg', size_bytes: 1, width: 800, height: 600, position_y: 50, fit_contain: false, purpose: 'story' },
              { id: 'g1', storage_path: 'w1/gallery.jpg', size_bytes: 1, width: null, height: null, position_y: 30, fit_contain: false, purpose: 'gallery' },
            ]
          : rows[table]
        const q = {
          select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
          then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
        }
        return q
      }),
    } as unknown as SupabaseClient
    return { supabase, tables }
  }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(resolveWeddingPlanId).mockResolvedValue('premium_monthly')
  })

  it('não deve exibir foto da história na galeria pública', async () => {
    const { supabase } = storyDatabase({ gallery_urls: [STORY_URL, GALLERY_URL] })
    const site = await getPublicSiteBySlug(supabase, 'casal')
    expect(site?.galleryPhotos.map((p) => p.url)).toEqual([GALLERY_URL])
    expect(site?.galleryPhotos[0]?.position_y).toBe(30)
  })

  it('deve manter a apresentação original e não consultar a história sem escolha de modo', async () => {
    const { supabase, tables } = storyDatabase({ our_story: 'Era uma vez' })
    const site = await getPublicSiteBySlug(supabase, 'casal')
    expect(site?.story).toEqual({ layout: 'legacy' })
    expect(tables).not.toContain('site_story_moments')
  })

  it('deve montar a história quando o casal escolheu uma apresentação', async () => {
    const { supabase } = storyDatabase({ our_story: 'Era uma vez', story_layout: 'timeline' })
    const site = await getPublicSiteBySlug(supabase, 'casal')
    if (!site || site.story.layout === 'legacy') throw new Error('esperado modo novo')
    expect(site.story.layout).toBe('timeline')
    expect(site.story.moments[0]?.dateLabel).toBe('março de 2018')
    expect(site.story.moments[0]?.photos[0]?.url).toBe(STORY_URL)
    expect(site.story.moments[0]?.photos[0]?.width).toBe(800)
  })
})
