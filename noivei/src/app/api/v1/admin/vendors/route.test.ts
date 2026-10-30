import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createSupabaseService: vi.fn() }))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('@/lib/vendor/deliver-vendor-emails', () => ({ deliverVendorEmails: vi.fn() }))
import { requireAuth } from '@/lib/auth/require-auth'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { deliverVendorEmails } from '@/lib/vendor/deliver-vendor-emails'
import { ApiError } from '@/lib/api/response'
import { POST } from './route'

const categoryId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const valid = { email: 'fornecedor@example.com', business_name: 'Empresa', cnpj: '11.222.333/0001-81', category_ids: [categoryId] }
function request(body: unknown) { return new Request('https://example.com/api/v1/admin/vendors', { method: 'POST', body: JSON.stringify(body) }) }
function setup(accountId: string | null = 'existing-user') {
  const session = {
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [{ id: categoryId }], error: null }) }),
    rpc: vi.fn().mockResolvedValue({ data: 'vendor-1', error: null }),
  }
  const service = {
    rpc: vi.fn().mockResolvedValue({ data: accountId, error: null }),
    auth: { admin: { inviteUserByEmail: vi.fn().mockResolvedValue({ data: { user: { id: 'invited-user' } }, error: null }) } },
  }
  vi.mocked(createSupabaseServer).mockResolvedValue(session as never)
  vi.mocked(createSupabaseService).mockReturnValue(service as never)
  return { session, service }
}

describe('cadastro administrativo de fornecedor', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    vi.mocked(requireAdmin).mockResolvedValue(undefined)
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 19 })
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com')
  })
  it('impede não-admin antes de consultar contas ou enviar convite', async () => {
    const { session } = setup()
    vi.mocked(requireAdmin).mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Página não encontrada.'))
    expect((await POST(request(valid))).status).toBe(404)
    expect(createSupabaseService).not.toHaveBeenCalled()
    expect(session.rpc).not.toHaveBeenCalled()
  })
  it.each([{ ...valid, cnpj: '' }, { ...valid, category_ids: [] }, { ...valid, email: 'inválido' }])('valida os campos obrigatórios antes de enviar convite', async (body) => {
    setup(null)
    expect((await POST(request(body))).status).toBe(400)
    expect(createSupabaseService).not.toHaveBeenCalled()
  })
  it('vincula a conta existente sem convidar nem alterar a senha e ignora campos privilegiados', async () => {
    const { session, service } = setup()
    const res = await POST(request({ ...valid, status: 'suspended', featured: true, user_id: 'outro' }))
    expect(res.status).toBe(201)
    expect(service.auth.admin.inviteUserByEmail).not.toHaveBeenCalled()
    expect(session.rpc).toHaveBeenCalledWith('fn_admin_create_vendor', expect.objectContaining({ p_user_id: 'existing-user', p_profile: { business_name: 'Empresa', cnpj: '11222333000181' }, p_category_ids: [categoryId] }))
    expect(deliverVendorEmails).toHaveBeenCalledWith('vendor-1')
  })
  it('convida uma nova conta para definir senha e vincula o usuário retornado', async () => {
    const { session, service } = setup(null)
    const res = await POST(request(valid))
    expect(res.status).toBe(201)
    expect(service.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(valid.email, { redirectTo: 'https://example.com/reset-password?next=/fornecedor' })
    expect(session.rpc).toHaveBeenCalledWith('fn_admin_create_vendor', expect.objectContaining({ p_user_id: 'invited-user' }))
    expect((await res.json()).data.invited).toBe(true)
  })
  it('não salva o fornecedor quando o convite falha', async () => {
    const { session, service } = setup(null)
    service.auth.admin.inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: 'SMTP' } } as never)
    expect((await POST(request(valid))).status).toBe(502)
    expect(session.rpc).not.toHaveBeenCalled()
    expect(deliverVendorEmails).not.toHaveBeenCalled()
  })
  it('rejeita categorias inativas antes de consultar ou convidar a conta', async () => {
    const { session } = setup(null)
    session.from.mockReturnValue({ select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) })
    expect((await POST(request(valid))).status).toBe(400)
    expect(createSupabaseService).not.toHaveBeenCalled()
  })
  it('não sobrescreve fornecedor existente e não envia aviso de sucesso', async () => {
    const { session } = setup()
    session.rpc.mockResolvedValue({ data: null, error: { code: '23505' } } as never)
    expect((await POST(request(valid))).status).toBe(409)
    expect(deliverVendorEmails).not.toHaveBeenCalled()
  })
})
