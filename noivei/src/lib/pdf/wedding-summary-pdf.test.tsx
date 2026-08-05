import { describe, expect, it } from 'vitest'
import { renderWeddingSummaryPdf, type WeddingSummaryPdfData } from './wedding-summary-pdf'

const baseData: WeddingSummaryPdfData = {
  coupleNames: 'Ana & Bruno',
  weddingDate: '2026-08-03',
  checklist:   { completed: 8, total: 10 },
  guests:      { total: 50, confirmed: 30, declined: 5, pending: 15 },
  financial:   { budgetCents: 5_000_000, totalSpentCents: 3_200_000 },
  gifts:       { purchased: 4, total: 12 },
  files:       { count: 7 },
  score:       null,
  generatedAt: new Date('2026-08-04T12:00:00-03:00'),
}

describe('renderWeddingSummaryPdf', () => {
  it('deve gerar um Buffer PDF não vazio quando o casamento não tem o Wedding Score liberado', async () => {
    const buffer = await renderWeddingSummaryPdf(baseData)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
    // Todo PDF válido começa com a assinatura `%PDF-`.
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-')
  })

  it('deve gerar um Buffer PDF não vazio quando o casamento tem o Wedding Score liberado com breakdown', async () => {
    const dataWithScore: WeddingSummaryPdfData = {
      ...baseData,
      score: {
        total: 72,
        breakdown: [
          { label: 'Checklist',  pct: 80 },
          { label: 'Financeiro', pct: 64 },
          { label: 'Convidados', pct: 90 },
          { label: 'RSVP',       pct: 60 },
          { label: 'Mesas',      pct: 40 },
          { label: 'Presentes',  pct: 33 },
          { label: 'Arquivos',   pct: 100 },
        ],
      },
    }

    const buffer = await renderWeddingSummaryPdf(dataWithScore)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('deve gerar um PDF sem orçamento definido quando budgetCents é null', async () => {
    const dataWithoutBudget: WeddingSummaryPdfData = {
      ...baseData,
      financial: { budgetCents: null, totalSpentCents: 0 },
    }

    const buffer = await renderWeddingSummaryPdf(dataWithoutBudget)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
  })
})
