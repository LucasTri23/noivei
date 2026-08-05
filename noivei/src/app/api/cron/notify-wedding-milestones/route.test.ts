import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resolveWeddingPlanIdMock = vi.fn()
const sendEmailMock = vi.fn().mockResolvedValue(undefined)
const renderWeddingSummaryPdfMock = vi.fn()

vi.mock('@/lib/billing/check-limit', () => ({
  resolveWeddingPlanId: (...args: unknown[]) => resolveWeddingPlanIdMock(...args),
}))

vi.mock('@/lib/email/send-email', () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}))

vi.mock('@/lib/pdf/wedding-summary-pdf', () => ({
  renderWeddingSummaryPdf: (...args: unknown[]) => renderWeddingSummaryPdfMock(...args),
}))

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: vi.fn(),
}))

import { createSupabaseService } from '@/lib/supabase/service'
import { GET } from './route'

const mockedCreateSupabaseService = vi.mocked(createSupabaseService)

const CRON_SECRET = 'test-cron-secret'

// yyyy-mm-dd da data de ontem em America/Sao_Paulo — mesmo fuso usado pelo cron
// pra calcular "hoje" e resolver o marco day_after (daysBetween(hoje, data) === -1).
function yesterdaySaoPaulo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

// Builder de query chainable genérico: qualquer método encadeado (select, eq,
// is, gte, lte, order, limit...) retorna o próprio objeto, que também é
// "thenable" — resolve pro valor informado quando aguardado diretamente
// (`await supabase.from(...).select(...).eq(...)`), sem precisar terminar a
// cadeia com .maybeSingle()/.single() quando a query real não termina assim.
function chainable(resolvedValue: unknown) {
  const methods = ['select', 'eq', 'is', 'gte', 'lte', 'not', 'order', 'limit'] as const
  const obj: Record<string, unknown> = {}
  for (const method of methods) {
    obj[method] = vi.fn(() => obj)
  }
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue)
  obj.single = vi.fn().mockResolvedValue(resolvedValue)
  obj.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(resolvedValue).then(onFulfilled, onRejected)
  return obj
}

interface WeddingRow {
  id: string
  user_id: string
  couple_names: string
  wedding_date: string
}

function buildSupabaseMock(weddings: WeddingRow[]) {
  let weddingsCallCount = 0

  const from = vi.fn((table: string) => {
    switch (table) {
      case 'weddings':
        weddingsCallCount += 1
        // 1ª chamada: query da lista de casamentos no range de marcos.
        // Chamadas seguintes: fetch pontual de budget/wedding_score dentro de
        // buildWeddingSummaryPdfData, um por casamento processado no marco day_after.
        if (weddingsCallCount === 1) return chainable({ data: weddings, error: null })
        return chainable({ data: { budget: 500_000, wedding_score: null, score_calculated_at: null }, error: null })
      case 'profiles':
        return chainable({ data: { notify_milestones: true }, error: null })
      case 'checklist_items':
        return chainable({ data: [{ completed: true }, { completed: false }], error: null })
      case 'guests':
        return chainable({ data: [{ status: 'confirmado' }, { status: 'pendente' }], error: null })
      case 'financial_entries':
        return chainable({ data: [{ total_amount: 10_000 }], error: null })
      case 'gift_registry_items':
        return chainable({ data: [{ is_purchased: true }, { is_purchased: false }], error: null })
      case 'wedding_files':
        return chainable({ count: 3, error: null })
      default:
        throw new Error(`tabela não mockada no teste: ${table}`)
    }
  })

  const rpc = vi.fn().mockResolvedValue({ data: false, error: null })

  const getUserById = vi.fn().mockResolvedValue({ data: { user: { email: 'casal@example.com' } } })

  return { from, rpc, auth: { admin: { getUserById } } }
}

function buildRequest(secret = CRON_SECRET): Request {
  return new Request('http://localhost/api/cron/notify-wedding-milestones', {
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('GET /api/cron/notify-wedding-milestones', () => {
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET
    mockedCreateSupabaseService.mockReset()
    resolveWeddingPlanIdMock.mockReset()
    sendEmailMock.mockClear()
    renderWeddingSummaryPdfMock.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret
    vi.restoreAllMocks()
  })

  it('deve enviar o e-mail do marco day_after mesmo quando a geração do PDF lança um erro, sem interromper os demais casamentos do loop', async () => {
    const weddingDate = yesterdaySaoPaulo()
    const weddings: WeddingRow[] = [
      { id: 'wedding-pdf-fails', user_id: 'user-1', couple_names: 'Ana & Bruno', wedding_date: weddingDate },
      { id: 'wedding-pdf-ok',    user_id: 'user-2', couple_names: 'Carla & Davi', wedding_date: weddingDate },
    ]

    const supabase = buildSupabaseMock(weddings)
    mockedCreateSupabaseService.mockReturnValue(supabase as never)
    resolveWeddingPlanIdMock.mockResolvedValue('premium_monthly')

    renderWeddingSummaryPdfMock
      .mockRejectedValueOnce(new Error('falha simulada na geração do PDF'))
      .mockResolvedValueOnce(Buffer.from('%PDF-fake'))

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    // Os dois casamentos receberam e-mail — a falha do primeiro PDF não derrubou
    // nem o e-mail dele, nem o processamento do segundo casamento no loop.
    expect(body.data.sent).toBe(2)
    expect(sendEmailMock).toHaveBeenCalledTimes(2)

    const [firstCallArgs] = sendEmailMock.mock.calls[0] as [{ attachments?: unknown }]
    expect(firstCallArgs.attachments).toBeUndefined()

    const [secondCallArgs] = sendEmailMock.mock.calls[1] as [{ attachments?: { filename: string }[] }]
    expect(secondCallArgs.attachments).toEqual([{ filename: 'resumo-casamento.pdf', content: Buffer.from('%PDF-fake') }])

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('falha ao gerar PDF de resumo do casamento wedding-pdf-fails'),
      expect.any(Error),
    )
  })

  it('deve rejeitar requisição sem o CRON_SECRET correto', async () => {
    const supabase = buildSupabaseMock([])
    mockedCreateSupabaseService.mockReturnValue(supabase as never)

    const response = await GET(buildRequest('secret-errado'))

    expect(response.status).toBe(401)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
