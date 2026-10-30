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
