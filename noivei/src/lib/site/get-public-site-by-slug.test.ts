import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
vi.mock('@/lib/billing/check-limit', () => ({ resolveWeddingPlanId: vi.fn() }))
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { getPublicSiteBySlug } from './get-public-site-by-slug'

function database(template: string) {
  return { from: vi.fn((table: string) => {
    const data = table === 'site_config' ? { wedding_id: 'w1', template, content: {} }
      : table === 'weddings' ? { couple_names: 'Ana & João', wedding_color: '#777c5a', wedding_color_secondary: '#a47859' }
      : table === 'plan_module_access' ? { enabled: true } : []
    const q = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }), order: vi.fn().mockReturnThis(), then: (resolve: (value: unknown) => void) => resolve({ data, error: null }) }
    return q
  }) } as unknown as SupabaseClient
}
describe('fallback público após downgrade', () => {
  beforeEach(() => vi.resetAllMocks())
  it.each(['editorial', 'garden', 'invitation'])('renderiza Clássico para %s fora do Exclusivo', async (template) => {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue('premium_monthly')
    expect((await getPublicSiteBySlug(database(template), 'casal'))?.template).toBe('classic')
  })
  it.each(['editorial', 'garden', 'invitation'])('preserva %s com plano Exclusivo ativo', async (template) => {
    vi.mocked(resolveWeddingPlanId).mockResolvedValue('premium_plus_once')
    expect((await getPublicSiteBySlug(database(template), 'casal'))?.template).toBe(template)
  })
})
