import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — factories não podem referenciar variáveis externas, só vi.fn() puro.
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { GET, POST } from './route'

const mockedRequireAuth          = vi.mocked(requireAuth)
const mockedCreateSupabaseServer = vi.mocked(createSupabaseServer)
const mockedCheckRateLimit       = vi.mocked(checkRateLimit)

const USER_ID          = '22222222-2222-2222-2222-222222222222'
const OTHER_USER_ID     = '99999999-9999-9999-9999-999999999999'
const CONVERSATION_ID  = '44444444-4444-4444-8444-444444444444'
const MESSAGE_ID        = '55555555-5555-4555-8555-555555555555'

function buildRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body:    body === undefined ? undefined : JSON.stringify(body),
  })
}

function buildParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

interface SupabaseMockOptions {
  conversationExists?: boolean
  messages?:            Record<string, unknown>[]
  insertedMessage?:      Record<string, unknown>
  insertError?:          { message: string } | null
}

function buildSupabaseMock(options: SupabaseMockOptions) {
  const insertedRows: Record<string, unknown>[] = []
  const lastMessagesQuery: { lt?: string } = {}

  const from = vi.fn((table: string) => {
    if (table === 'vendor_conversations') {
      return {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.conversationExists === false ? null : { id: CONVERSATION_ID },
          error: null,
        }),
      }
    }

    if (table === 'vendor_messages') {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        is:     vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(),
        lt:     vi.fn((_column: string, value: string) => { lastMessagesQuery.lt = value; return builder }),
        limit:  vi.fn().mockResolvedValue({ data: options.messages ?? [], error: null }),
        insert: vi.fn((row: Record<string, unknown>) => {
          insertedRows.push(row)
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data:  options.insertError ? null : { id: MESSAGE_ID, deleted_at: null, created_at: '2026-08-13T10:00:00.000Z', ...row, ...options.insertedMessage },
              error: options.insertError ?? null,
            }),
          }
        }),
      }
      // .limit() precisa poder ser "então" (usado no fim de uma cadeia GET, sem
      // await explícito extra) — como é a última chamada da cadeia no route.ts (via
      // `await query`), um mock resolvido já serve como thenable compatível.
      return builder
    }

    throw new Error(`tabela não mockada no teste: ${table}`)
  })

  return { from, insertedRows, get lastMessagesQuery() { return lastMessagesQuery } }
}

describe('GET /api/v1/vendor-conversations/[id]/messages', () => {
  beforeEach(() => {
    mockedRequireAuth.mockReset()
    mockedCreateSupabaseServer.mockReset()
    mockedRequireAuth.mockResolvedValue({ user: { id: USER_ID } } as never)
  })

  it('deve retornar 404 quando a conversa não existe ou o usuário não participa dela (RLS filtra)', async () => {
    const supabase = buildSupabaseMock({ conversationExists: false })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await GET(
      buildRequest(`http://localhost/api/v1/vendor-conversations/${CONVERSATION_ID}/messages`, 'GET'),
      buildParams(CONVERSATION_ID),
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('CONVERSATION_NOT_FOUND')
  })

  it('deve devolver as mensagens em ordem cronológica (mais antiga primeiro)', async () => {
    const messages = [
      { id: 'm2', created_at: '2026-08-13T10:01:00.000Z', body: 'segunda' },
      { id: 'm1', created_at: '2026-08-13T10:00:00.000Z', body: 'primeira' },
    ] // mock devolve na ordem DESC que a query pede (mais nova primeiro)
    const supabase = buildSupabaseMock({ conversationExists: true, messages })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await GET(
      buildRequest(`http://localhost/api/v1/vendor-conversations/${CONVERSATION_ID}/messages`, 'GET'),
      buildParams(CONVERSATION_ID),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.map((m: { id: string }) => m.id)).toEqual(['m1', 'm2'])
  })

  it('deve rejeitar um parâmetro "before" inválido com 400', async () => {
    const supabase = buildSupabaseMock({ conversationExists: true, messages: [] })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await GET(
      buildRequest(`http://localhost/api/v1/vendor-conversations/${CONVERSATION_ID}/messages?before=não-é-uma-data`, 'GET'),
      buildParams(CONVERSATION_ID),
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /api/v1/vendor-conversations/[id]/messages', () => {
  beforeEach(() => {
    mockedRequireAuth.mockReset()
    mockedCreateSupabaseServer.mockReset()
    mockedCheckRateLimit.mockReset()

    mockedRequireAuth.mockResolvedValue({ user: { id: USER_ID } } as never)
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 29 })
  })

  it('deve retornar 404 quando a conversa não existe ou o usuário não participa dela', async () => {
    const supabase = buildSupabaseMock({ conversationExists: false })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(
      buildRequest(`http://localhost/api/v1/vendor-conversations/${CONVERSATION_ID}/messages`, 'POST', { body: 'oi' }),
      buildParams(CONVERSATION_ID),
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('CONVERSATION_NOT_FOUND')
    expect(supabase.insertedRows).toHaveLength(0)
  })

  it('deve retornar 429 quando o limite de 30 mensagens/minuto é excedido', async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })
    const supabase = buildSupabaseMock({ conversationExists: true })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(
      buildRequest(`http://localhost/api/v1/vendor-conversations/${CONVERSATION_ID}/messages`, 'POST', { body: 'oi' }),
      buildParams(CONVERSATION_ID),
    )
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(supabase.insertedRows).toHaveLength(0)
  })

  it('deve rejeitar mensagem vazia e mensagem acima de 4000 caracteres com 400', async () => {
    const supabase = buildSupabaseMock({ conversationExists: true })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const empty = await POST(
      buildRequest(`http://localhost/api/v1/vendor-conversations/${CONVERSATION_ID}/messages`, 'POST', { body: '   ' }),
      buildParams(CONVERSATION_ID),
    )
    expect(empty.status).toBe(400)

    const tooLong = await POST(
      buildRequest(`http://localhost/api/v1/vendor-conversations/${CONVERSATION_ID}/messages`, 'POST', { body: 'a'.repeat(4001) }),
      buildParams(CONVERSATION_ID),
    )
    expect(tooLong.status).toBe(400)
    expect(supabase.insertedRows).toHaveLength(0)
  })

  // O TESTE mais importante desta rota: sender_user_id é SEMPRE user.id do
  // servidor (requireAuth), nunca um valor vindo do body — mesmo que o client
  // tente forjar. SendVendorMessageSchema nem tem esse campo (ver
  // vendor-conversation.schema.ts), então mesmo que alguém contorne o TypeScript
  // e injete `sender_user_id` no JSON puro, `parsed.data` (usado no insert) nunca
  // carrega esse campo — só `body` sobrevive ao safeParse.
  it('deve SEMPRE usar o user.id autenticado como sender_user_id, mesmo se o body tentar forjar outro', async () => {
    const supabase = buildSupabaseMock({ conversationExists: true })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(
      buildRequest(`http://localhost/api/v1/vendor-conversations/${CONVERSATION_ID}/messages`, 'POST', {
        body: 'mensagem legítima',
        sender_user_id: OTHER_USER_ID, // tentativa de forjar — deve ser ignorada
      }),
      buildParams(CONVERSATION_ID),
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(supabase.insertedRows).toHaveLength(1)
    expect(supabase.insertedRows[0]?.sender_user_id).toBe(USER_ID)
    expect(supabase.insertedRows[0]?.sender_user_id).not.toBe(OTHER_USER_ID)
    expect(body.data.sender_user_id).toBe(USER_ID)
  })

  it('deve criar a mensagem (201) com o corpo validado', async () => {
    const supabase = buildSupabaseMock({ conversationExists: true })
    mockedCreateSupabaseServer.mockResolvedValue(supabase as never)

    const res = await POST(
      buildRequest(`http://localhost/api/v1/vendor-conversations/${CONVERSATION_ID}/messages`, 'POST', { body: '  Olá!  ' }),
      buildParams(CONVERSATION_ID),
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(supabase.insertedRows[0]).toEqual({ conversation_id: CONVERSATION_ID, sender_user_id: USER_ID, body: 'Olá!' })
    expect(body.data.id).toBe(MESSAGE_ID)
  })
})
