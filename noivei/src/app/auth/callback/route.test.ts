import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }))
vi.mock('@/lib/auth/account-type', async (original) => ({ ...await original<typeof import('@/lib/auth/account-type')>(), requireAccountType: vi.fn() }))
vi.mock('@/lib/weddings/get-user-wedding', () => ({ getUserWedding: vi.fn() }))
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAccountType } from '@/lib/auth/account-type'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'
import { ApiError } from '@/lib/api/response'
import { GET } from './route'
const auth = { exchangeCodeForSession: vi.fn(), getUser: vi.fn(), signOut: vi.fn() }
beforeEach(() => {
  vi.resetAllMocks()
  auth.exchangeCodeForSession.mockResolvedValue({ error: null })
  auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  auth.signOut.mockResolvedValue({ error: null })
  vi.mocked(createSupabaseServer).mockResolvedValue({ auth } as never)
  vi.mocked(requireAccountType).mockResolvedValue(undefined)
})
describe('tipos de conta no callback OAuth', () => {
  it('envia fornecedor ao cadastro sem procurar casamento', async () => {
    const res = await GET(new Request('https://example.com/auth/callback?code=ok&next=/fornecedor/cadastro'))
    expect(res.headers.get('location')).toBe('https://example.com/fornecedor/cadastro')
    expect(requireAccountType).toHaveBeenCalledWith(expect.anything(), 'vendor')
    expect(getUserWedding).not.toHaveBeenCalled()
  })
  it('encerra sessão e informa conflito ao usar Google do outro tipo', async () => {
    vi.mocked(requireAccountType).mockRejectedValue(new ApiError(409, 'ACCOUNT_TYPE_CONFLICT', 'Outro tipo'))
    const res = await GET(new Request('https://example.com/auth/callback?code=ok&next=/fornecedor'))
    expect(res.headers.get('location')).toContain('error=account_type_conflict')
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(getUserWedding).not.toHaveBeenCalled()
  })
  it('mantém recuperação de senha independente do tipo de conta', async () => {
    const res = await GET(new Request('https://example.com/auth/callback?code=ok&type=recovery'))
    expect(res.headers.get('location')).toBe('https://example.com/reset-password')
    expect(requireAccountType).not.toHaveBeenCalled()
  })
  it('encaminha novos noivos ao onboarding', async () => {
    vi.mocked(getUserWedding).mockResolvedValue(null)
    const res = await GET(new Request('https://example.com/auth/callback?code=ok'))
    expect(res.headers.get('location')).toBe('https://example.com/onboarding')
    expect(requireAccountType).toHaveBeenCalledWith(expect.anything(), 'couple')
  })
})
