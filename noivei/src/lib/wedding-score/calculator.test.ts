import { describe, expect, it } from 'vitest'
import { calculateWeddingScore, type WeddingScoreModuleKey, type WeddingScoreModulePcts } from './calculator'

const LABELS: Record<WeddingScoreModuleKey, string> = {
  checklist:  'Checklist',
  financeiro: 'Financeiro',
  convidados: 'Convidados',
  rsvp:       'RSVP',
  mesas:      'Mesas',
  presentes:  'Presentes',
  arquivos:   'Arquivos',
}

// Pesos do roadmap (migration 20260805000008), soma 100.
const ROADMAP_WEIGHTS: Record<WeddingScoreModuleKey, number> = {
  checklist:  25,
  financeiro: 20,
  convidados: 15,
  rsvp:       10,
  mesas:      10,
  presentes:  10,
  arquivos:   10,
}

const ALL_ZERO_PCTS: WeddingScoreModulePcts = {
  checklist: 0, financeiro: 0, convidados: 0, rsvp: 0, mesas: 0, presentes: 0, arquivos: 0,
}

const ALL_FULL_PCTS: WeddingScoreModulePcts = {
  checklist: 100, financeiro: 100, convidados: 100, rsvp: 100, mesas: 100, presentes: 100, arquivos: 100,
}

describe('calculateWeddingScore', () => {
  describe('normalização de pesos', () => {
    it('deve normalizar os pesos pela soma real quando a soma for diferente de 100', () => {
      // Só checklist com peso, financeiro com o dobro do peso de checklist — a soma
      // nominal (60) não é 100, mas a proporção relativa entre os dois deve continuar
      // valendo: financeiro pesa o dobro de checklist.
      const weights: Record<WeddingScoreModuleKey, number> = {
        checklist: 20, financeiro: 40, convidados: 0, rsvp: 0, mesas: 0, presentes: 0, arquivos: 0,
      }
      const pcts: WeddingScoreModulePcts = {
        checklist: 100, financeiro: 50, convidados: 0, rsvp: 0, mesas: 0, presentes: 0, arquivos: 0,
      }

      const result = calculateWeddingScore(pcts, weights, LABELS)

      // (100*20 + 50*40) / 60 = (2000 + 2000) / 60 = 66.67 -> arredonda 67
      expect(result.total).toBe(67)
    })

    it('deve manter o resultado em 0-100 mesmo quando a soma dos pesos ultrapassa 100', () => {
      const weights: Record<WeddingScoreModuleKey, number> = {
        checklist: 100, financeiro: 100, convidados: 100, rsvp: 100, mesas: 100, presentes: 100, arquivos: 100,
      }

      const result = calculateWeddingScore(ALL_FULL_PCTS, weights, LABELS)

      expect(result.total).toBe(100)
    })
  })

  describe('peso zero', () => {
    it('deve fazer um módulo com peso 0 não contar para o total', () => {
      const weights: Record<WeddingScoreModuleKey, number> = {
        checklist: 0, financeiro: 100, convidados: 0, rsvp: 0, mesas: 0, presentes: 0, arquivos: 0,
      }
      // checklist em 0% não deveria puxar o total pra baixo, porque seu peso é 0.
      const pcts: WeddingScoreModulePcts = {
        checklist: 0, financeiro: 100, convidados: 0, rsvp: 0, mesas: 0, presentes: 0, arquivos: 0,
      }

      const result = calculateWeddingScore(pcts, weights, LABELS)

      expect(result.total).toBe(100)
      expect(result.breakdown.find((item) => item.module === 'checklist')?.weight).toBe(0)
    })
  })

  describe('extremos', () => {
    it('deve retornar score 0 quando todos os módulos estão em 0%', () => {
      const result = calculateWeddingScore(ALL_ZERO_PCTS, ROADMAP_WEIGHTS, LABELS)

      expect(result.total).toBe(0)
      expect(result.breakdown.every((item) => item.pct === 0)).toBe(true)
    })

    it('deve retornar score 100 quando todos os módulos estão em 100%', () => {
      const result = calculateWeddingScore(ALL_FULL_PCTS, ROADMAP_WEIGHTS, LABELS)

      expect(result.total).toBe(100)
    })
  })

  describe('proteção contra denominador 0', () => {
    it('deve retornar score 0 (não NaN) quando a soma de todos os pesos é 0', () => {
      const zeroWeights: Record<WeddingScoreModuleKey, number> = {
        checklist: 0, financeiro: 0, convidados: 0, rsvp: 0, mesas: 0, presentes: 0, arquivos: 0,
      }

      const result = calculateWeddingScore(ALL_FULL_PCTS, zeroWeights, LABELS)

      expect(result.total).toBe(0)
      expect(Number.isNaN(result.total)).toBe(false)
    })

    it('deve descartar pct não finito (NaN/Infinity) de um módulo em vez de propagar para o total', () => {
      const pctsComDenominadorZero: WeddingScoreModulePcts = {
        // Simula o que aconteceria sem a proteção de denominador 0 em recalculate.ts
        // (ex: 0/0) chegando até aqui — a function pura deve neutralizar, não propagar.
        checklist: NaN, financeiro: 0, convidados: 0, rsvp: 0, mesas: 0, presentes: 0, arquivos: 0,
      }

      const result = calculateWeddingScore(pctsComDenominadorZero, ROADMAP_WEIGHTS, LABELS)

      expect(Number.isNaN(result.total)).toBe(false)
      expect(result.breakdown.find((item) => item.module === 'checklist')?.pct).toBe(0)
    })
  })

  describe('breakdown', () => {
    it('deve retornar um item de breakdown por módulo, com label e peso corretos', () => {
      const result = calculateWeddingScore(ALL_ZERO_PCTS, ROADMAP_WEIGHTS, LABELS)

      expect(result.breakdown).toHaveLength(7)
      const checklistItem = result.breakdown.find((item) => item.module === 'checklist')
      expect(checklistItem).toMatchObject({ module: 'checklist', label: 'Checklist', weight: 25, pct: 0 })
    })
  })
})
