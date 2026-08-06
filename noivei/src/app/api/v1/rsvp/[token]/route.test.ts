import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — factories não podem referenciar variáveis externas, só vi.fn() puro.
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  getClientIp:    vi.fn(() => '127.0.0.1'),
}))
vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: vi.fn(),
}))
vi.mock('@/lib/billing/check-limit', () => ({
  checkGuestLimit: vi.fn(),
}))
vi.mock('@/lib/rsvp/notify-rsvp-response', () => ({
  notifyRsvpResponse: vi.fn(),
}))
vi.mock('next/server', () => ({
  after: (fn: () => void) => fn(),
}))

import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseService } from '@/lib/supabase/service'
import { PATCH } from './route'

const mockedCheckRateLimit = vi.mocked(checkRateLimit)
const mockedCreateSupabaseService = vi.mocked(createSupabaseService)

const TOKEN = 'a-valid-rsvp-token-1234'

function buildRequest(body: unknown): Request {
  return new Request(`http://localhost/api/v1/rsvp/${TOKEN}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

function buildSupabaseMock(guestRow: Record<string, unknown> | null) {
  // Só a query inicial (select por rsvp_token) é esperada quando o guard de
  // ALREADY_RESPONDED barra a requisição — qualquer chamada de update/delete depois
  // disso prova que o guard NÃO interrompeu o fluxo antes de mexer nos dados.
  const from = vi.fn((table: string) => {
    if (table !== 'guests') throw new Error(`tabela não mockada: ${table}`)

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: guestRow, error: null }),
      update: vi.fn(() => {
        throw new Error('update() não deveria ser chamado quando o convite já foi respondido')
      }),
      delete: vi.fn(() => {
        throw new Error('delete() não deveria ser chamado quando o convite já foi respondido')
      }),
    }
  })

  return { from }
}

const validBody = { status: 'recusado', phone: '11999999999' }

describe('PATCH /api/v1/rsvp/[token]', () => {
  beforeEach(() => {
    mockedCheckRateLimit.mockReset()
    mockedCreateSupabaseService.mockReset()
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10 })
  })

  it('deve rejeitar com 409 ALREADY_RESPONDED quando o convidado já respondeu antes, sem tocar nos dados', async () => {
    const supabase = buildSupabaseMock({
      id: 'g1', phone: '11999999999', name: 'Maria', group_name: null,
      wedding_id: 'w1', party_size: 1, status: 'confirmado',
    })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const res = await PATCH(buildRequest(validBody), { params: Promise.resolve({ token: TOKEN }) })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('ALREADY_RESPONDED')
  })

  it('deve rejeitar com 409 ALREADY_RESPONDED mesmo quando a resposta enviada é igual à já registrada', async () => {
    // Reenviar exatamente a mesma resposta ('recusado' de novo) também precisa ser
    // bloqueado — não é só sobre mudar de ideia, é sobre o link não aceitar mais
    // envio nenhum depois de usado uma vez.
    const supabase = buildSupabaseMock({
      id: 'g1', phone: '11999999999', name: 'Maria', group_name: null,
      wedding_id: 'w1', party_size: 1, status: 'recusado',
    })
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const res = await PATCH(buildRequest(validBody), { params: Promise.resolve({ token: TOKEN }) })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('ALREADY_RESPONDED')
  })

  it('deve devolver 404 quando o token não existe (não deve vazar ALREADY_RESPONDED pra token inválido)', async () => {
    const supabase = buildSupabaseMock(null)
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const res = await PATCH(buildRequest(validBody), { params: Promise.resolve({ token: TOKEN }) })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('RSVP_NOT_FOUND')
  })
})
