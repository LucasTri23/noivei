import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — factories não podem referenciar variáveis externas, só vi.fn() puro.
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/api/guards/ownership', () => ({
  requireWeddingOwnership: vi.fn(),
  requireModuleAccess:     vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}))

import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import { POST } from './route'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedRequireWeddingOwnership = vi.mocked(requireWeddingOwnership)
const mockedRequireModuleAccess = vi.mocked(requireModuleAccess)
const mockedCreateSupabaseServer = vi.mocked(createSupabaseServer)

const WEDDING_ID = '11111111-1111-1111-1111-111111111111'
const USER_ID    = '22222222-2222-2222-2222-222222222222'
const GUEST_ID   = '33333333-3333-4333-8333-333333333333'

function buildRequest(): Request {
  return new Request(`http://localhost/api/v1/weddings/${WEDDING_ID}/guests/${GUEST_ID}/resend-invite`, {
    method: 'POST',
  })
}

function buildSupabaseMock(options: { notFound?: boolean; error?: { message: string } | null }) {
  let capturedUpdate: Record<string, unknown> | undefined

  const from = vi.fn((table: string) => {
    if (table !== 'guests') throw new Error(`tabela não mockada: ${table}`)

    return {
      update: vi.fn((row: Record<string, unknown>) => {
        capturedUpdate = row
        return {
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data:  options.error || options.notFound ? null : { id: GUEST_ID, ...row },
            error: options.error ?? null,
          }),
        }
      }),
    }
  })

  return { from, get capturedUpdate() { return capturedUpdate } }
}

describe('POST /api/v1/weddings/[wid]/guests/[id]/resend-invite', () => {
  beforeEach(() => {
    mockedRequireAuth.mockReset()
    mockedRequireWeddingOwnership.mockReset()
    mockedRequireModuleAccess.mockReset()
    mockedCreateSupabaseServer.mockReset()

    mockedRequireAuth.mockResolvedValue({ user: { id: USER_ID } } as never)
    mockedRequireWeddingOwnership.mockResolvedValue(undefined)
    mockedRequireModuleAccess.mockResolvedValue(undefined)
  })

  it('deve gerar um rsvp_token novo e resetar status/attending_count pra reabrir a resposta', async () => {
    const supabase = buildSupabaseMock({})
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest(), { params: Promise.resolve({ wid: WEDDING_ID, id: GUEST_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(supabase.capturedUpdate?.status).toBe('pendente')
    expect(supabase.capturedUpdate?.attending_count).toBeNull()
    expect(typeof supabase.capturedUpdate?.rsvp_token).toBe('string')
    expect((supabase.capturedUpdate?.rsvp_token as string).length).toBeGreaterThan(10)
    expect(supabase.capturedUpdate?.invite_sent_at).toBeTruthy()
    expect(body.data.id).toBe(GUEST_ID)
  })

  it('deve devolver 404 quando o convidado não existe nesse casamento', async () => {
    const supabase = buildSupabaseMock({ notFound: true })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest(), { params: Promise.resolve({ wid: WEDDING_ID, id: GUEST_ID }) })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('GUEST_NOT_FOUND')
  })

  it('deve devolver 404 quando o id do convidado não é um UUID válido', async () => {
    const supabase = buildSupabaseMock({})
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(buildRequest(), { params: Promise.resolve({ wid: WEDDING_ID, id: 'not-a-uuid' }) })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('GUEST_NOT_FOUND')
  })
})
