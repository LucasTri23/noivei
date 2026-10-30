import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/vendor/deliver-vendor-emails', () => ({ deliverVendorEmails: vi.fn().mockResolvedValue({ sent: 2, failed: 0 }) }))
vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: vi.fn() }))

import { ApiError } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { POST } from './route'

const mockedRequireAuth          = vi.mocked(requireAuth)
const mockedRequireAdmin         = vi.mocked(requireAdmin)
const mockedCreateSupabaseServer = vi.mocked(createSupabaseServer)
const mockedCheckRateLimit       = vi.mocked(checkRateLimit)

const ADMIN_ID  = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const VENDOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function buildRequest(body: unknown): Request {
  return new Request(`http://localhost/api/v1/admin/vendors/${VENDOR_ID}/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

function buildSupabaseMock(vendorStatus: string, updateSucceeds = true) {
  const insertedActions: Record<string, unknown>[] = []

  const from = vi.fn((table: string) => {
    if (table === 'vendor_profiles') {
      return {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: VENDOR_ID, status: vendorStatus }, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue(
                  updateSucceeds
                    ? { data: { id: VENDOR_ID, status: 'active' }, error: null }
                    : { data: null, error: null },
                ),
              }),
            }),
          }),
        }),
      }
    }
    if (table === 'vendor_admin_actions') {
      return { insert: vi.fn((payload: unknown) => { insertedActions.push(payload as Record<string, unknown>); return Promise.resolve({ error: null }) }) }
    }
    throw new Error(`tabela não mockada no teste: ${table}`)
  })

  return { from, insertedActions }
}

describe('POST /api/v1/admin/vendors/[id]/status', () => {
  beforeEach(() => {
    mockedRequireAuth.mockReset()
    mockedRequireAdmin.mockReset()
    mockedCreateSupabaseServer.mockReset()
    mockedCheckRateLimit.mockReset()

    mockedRequireAuth.mockResolvedValue({ user: { id: ADMIN_ID } } as never)
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99 })
  })

  it('deve bloquear usuário não-admin com 404 (requireAdmin lança ApiError)', async () => {
    mockedRequireAdmin.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Página não encontrada.'))
    mockedCreateSupabaseServer.mockResolvedValue(buildSupabaseMock('pending_review') as never)

    const res = await POST(buildRequest({ action: 'approve' }), { params: Promise.resolve({ id: VENDOR_ID }) })

    expect(res.status).toBe(404)
  })

  it('deve aprovar um fornecedor pending_review e registrar em vendor_admin_actions', async () => {
    mockedRequireAdmin.mockResolvedValue(undefined)
    const supabase = buildSupabaseMock('pending_review')
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest({ action: 'approve' }), { params: Promise.resolve({ id: VENDOR_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.status).toBe('active')
    expect(supabase.insertedActions).toEqual([
      expect.objectContaining({ admin_id: ADMIN_ID, vendor_id: VENDOR_ID, action: 'approve' }),
    ])
  })

  it('não deve permitir "approve" a partir de um status que não seja pending_review', async () => {
    mockedRequireAdmin.mockResolvedValue(undefined)
    mockedCreateSupabaseServer.mockResolvedValue(buildSupabaseMock('draft') as never)

    const res = await POST(buildRequest({ action: 'approve' }), { params: Promise.resolve({ id: VENDOR_ID }) })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('INVALID_STATUS_TRANSITION')
  })

  it('não deve aceitar uma ação desconhecida (nunca confia em status alvo vindo do client)', async () => {
    mockedRequireAdmin.mockResolvedValue(undefined)
    mockedCreateSupabaseServer.mockResolvedValue(buildSupabaseMock('pending_review') as never)

    const res = await POST(buildRequest({ action: 'become_admin' }), { params: Promise.resolve({ id: VENDOR_ID }) })

    expect(res.status).toBe(400)
  })

  it('deve retornar 409 quando a transição otimista falha por corrida (status mudou entre o fetch e o update)', async () => {
    mockedRequireAdmin.mockResolvedValue(undefined)
    mockedCreateSupabaseServer.mockResolvedValue(buildSupabaseMock('pending_review', false) as never)

    const res = await POST(buildRequest({ action: 'approve' }), { params: Promise.resolve({ id: VENDOR_ID }) })

    expect(res.status).toBe(409)
  })
})
