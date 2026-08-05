import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — factories não podem referenciar variáveis externas, só vi.fn()
// puro. Mesmo padrão de mocking de
// src/app/api/v1/weddings/[wid]/financial/route.test.ts.
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: vi.fn(),
}))
vi.mock('@/lib/weddings/get-user-wedding', () => ({
  getUserWedding: vi.fn(),
}))
vi.mock('@/lib/billing/check-limit', () => ({
  checkMemberLimit: vi.fn(),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  getClientIp:    vi.fn(() => '203.0.113.1'),
}))
// `after()` (next/server) exige um request scope real do Next.js — fora dele (como
// numa chamada direta de handler em teste unitário) ele LANÇA. O código só o chama no
// caminho de sucesso (aceite concluído), então sem este mock todo teste de sucesso
// falharia com INTERNAL_ERROR só por causa do agendamento do e-mail best-effort, que
// não é o que estes testes verificam.
vi.mock('next/server', () => ({
  after: vi.fn(),
}))

import { checkMemberLimit } from '@/lib/billing/check-limit'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseService } from '@/lib/supabase/service'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'
import { POST } from './route'

const mockedRequireAuth          = vi.mocked(requireAuth)
const mockedCreateSupabaseService = vi.mocked(createSupabaseService)
const mockedGetUserWedding       = vi.mocked(getUserWedding)
const mockedCheckMemberLimit     = vi.mocked(checkMemberLimit)
const mockedCheckRateLimit       = vi.mocked(checkRateLimit)

const TOKEN      = 'test-invite-token'
const WEDDING_ID = '11111111-1111-1111-1111-111111111111'
const USER_ID    = '22222222-2222-2222-2222-222222222222'

interface InviteRow {
  id:             string
  wedding_id:     string
  status:         'pending' | 'accepted' | 'revoked'
  expires_at:     string
  accepted_by:    string | null
  permissions:    { full_access: boolean }
  invited_email:  string | null
}

function buildInvite(overrides: Partial<InviteRow> = {}): InviteRow {
  return {
    id:            'invite-1',
    wedding_id:    WEDDING_ID,
    status:        'pending',
    expires_at:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    accepted_by:   null,
    permissions:   { full_access: true },
    invited_email: null,
    ...overrides,
  }
}

function buildSupabaseMock(options: {
  invite:          InviteRow | null
  existingMember?: { id: string } | null
  insertError?:    { code?: string; message: string } | null
  updateError?:    { message: string } | null
}) {
  const insertCalls: Record<string, unknown>[] = []
  const updateCalls: Record<string, unknown>[] = []

  const from = vi.fn((table: string) => {
    if (table === 'wedding_invites') {
      return {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: options.invite, error: null }),
        update: vi.fn((patch: Record<string, unknown>) => {
          updateCalls.push(patch)
          return { eq: vi.fn().mockResolvedValue({ error: options.updateError ?? null }) }
        }),
      }
    }

    if (table === 'wedding_members') {
      return {
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: options.existingMember ?? null, error: null }),
        insert: vi.fn((row: Record<string, unknown>) => {
          insertCalls.push(row)
          return Promise.resolve({ error: options.insertError ?? null })
        }),
      }
    }

    throw new Error(`tabela não mockada no teste: ${table}`)
  })

  return { from, insertCalls, updateCalls }
}

function buildRequest(token: string, body?: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/v1/invites/${token}/accept`, {
    method:  'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body:    body ? JSON.stringify(body) : undefined,
  })
}

async function callAccept(token = TOKEN, body?: Record<string, unknown>) {
  const res = await POST(buildRequest(token, body), { params: Promise.resolve({ token }) })
  const json = await res.json()
  return { res, json }
}

describe('POST /api/v1/invites/[token]/accept — SEC-003 (invited_email)', () => {
  beforeEach(() => {
    mockedRequireAuth.mockReset()
    mockedCreateSupabaseService.mockReset()
    mockedGetUserWedding.mockReset()
    mockedCheckMemberLimit.mockReset()
    mockedCheckRateLimit.mockReset()

    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10 })
    // Sem casamento atual: não entra no fluxo de "já é membro de outro casamento",
    // que não é o que estes testes verificam.
    mockedGetUserWedding.mockResolvedValue(null)
    mockedCheckMemberLimit.mockResolvedValue({ allowed: true, current: 1, limit: 5, planId: 'free' } as never)
  })

  it('aceita quando invited_email bate com o e-mail da conta autenticada (case-insensitive, com espaços)', async () => {
    mockedRequireAuth.mockResolvedValue({ user: { id: USER_ID, email: '  Ana@Example.COM  ' } } as never)

    const invite = buildInvite({ invited_email: 'ana@example.com' })
    const supabase = buildSupabaseMock({ invite })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const { res, json } = await callAccept()

    expect(res.status).toBe(200)
    expect(json.data.wedding_id).toBe(WEDDING_ID)
    // Realmente entrou como membro e o convite foi marcado como aceito.
    expect(supabase.insertCalls).toHaveLength(1)
    expect(supabase.insertCalls[0]).toMatchObject({ wedding_id: WEDDING_ID, user_id: USER_ID })
    expect(supabase.updateCalls).toHaveLength(1)
    expect(supabase.updateCalls[0]).toMatchObject({ status: 'accepted', accepted_by: USER_ID })
  })

  it('rejeita com EMAIL_MISMATCH (403) quando o e-mail da conta não bate com invited_email', async () => {
    mockedRequireAuth.mockResolvedValue({ user: { id: USER_ID, email: 'outra-pessoa@example.com' } } as never)

    const invite = buildInvite({ invited_email: 'ana@example.com' })
    const supabase = buildSupabaseMock({ invite })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const { res, json } = await callAccept()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe('EMAIL_MISMATCH')
    expect(json.error.message).toBe(
      'Este convite foi enviado para outro endereço de e-mail. Entre com a conta correta para continuar.',
    )
    // Não revela o e-mail esperado.
    expect(json.error.message).not.toContain('ana@example.com')
    // Barra ANTES de qualquer outra regra de negócio: nem chega a checar o casamento
    // atual do usuário, nem insere o membro.
    expect(mockedGetUserWedding).not.toHaveBeenCalled()
    expect(supabase.insertCalls).toHaveLength(0)
    expect(supabase.updateCalls).toHaveLength(0)
  })

  it('convite antigo com invited_email = null continua sendo aceito por qualquer conta autenticada', async () => {
    mockedRequireAuth.mockResolvedValue({ user: { id: USER_ID, email: 'qualquer-pessoa@example.com' } } as never)

    const invite = buildInvite({ invited_email: null })
    const supabase = buildSupabaseMock({ invite })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const { res, json } = await callAccept()

    expect(res.status).toBe(200)
    expect(json.data.wedding_id).toBe(WEDDING_ID)
    expect(supabase.insertCalls).toHaveLength(1)
    expect(supabase.updateCalls).toHaveLength(1)
  })
})
