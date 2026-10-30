import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/api/guards/vendor', () => ({ requireVendorProfile: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('@/lib/vendor/deliver-vendor-emails', () => ({ deliverVendorEmails: vi.fn() }))
import { requireAuth } from '@/lib/auth/require-auth'
import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { createSupabaseServer } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { deliverVendorEmails } from '@/lib/vendor/deliver-vendor-emails'
import { POST } from './route'

describe('envio da solicitação', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    vi.mocked(requireVendorProfile).mockResolvedValue({ id: 'vendor-1', status: 'draft', cnpj: '11222333000181' } as never)
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9 })
  })
  function setup(count = 1, updated = true) {
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: updated ? { id: 'vendor-1', status: 'pending_review' } : null, error: null }) })
    vi.mocked(createSupabaseServer).mockResolvedValue({ from: vi.fn((table: string) => table === 'vendor_category_links' ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ count, error: null }) } : { update }) } as never)
    return update
  }
  it('não envia sem CNPJ e não dispara e-mail', async () => {
    const update = setup()
    vi.mocked(requireVendorProfile).mockResolvedValue({ id: 'vendor-1', status: 'draft', cnpj: null } as never)
    expect((await POST()).status).toBe(400)
    expect(update).not.toHaveBeenCalled()
    expect(deliverVendorEmails).not.toHaveBeenCalled()
  })
  it('não envia sem categoria', async () => {
    setup(0)
    expect((await POST()).status).toBe(400)
    expect(deliverVendorEmails).not.toHaveBeenCalled()
  })
  it('notifica somente após a transição para análise', async () => {
    setup()
    expect((await POST()).status).toBe(200)
    expect(deliverVendorEmails).toHaveBeenCalledWith('vendor-1')
  })
  it('não notifica se outra requisição já mudou o status', async () => {
    setup(1, false)
    expect((await POST()).status).toBe(409)
    expect(deliverVendorEmails).not.toHaveBeenCalled()
  })
})
