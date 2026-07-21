// Funções puras, sem efeitos colaterais além do cálculo

export interface WeddingScoreInput {
  /** Itens de checklist não arquivados nem dispensados */
  checklistTotal:      number
  checklistCompleted:  number
  /** Convidados cadastrados no casamento */
  guestsTotal:         number
  /** Convidados com status `confirmado` ou `recusado` (já responderam o RSVP) */
  guestsResponded:     number
  /** `weddings.budget` — `null` quando o casal ainda não definiu um orçamento */
  budget:              number | null
  /** Soma de `financial_entries.total_amount` lançados para o casamento */
  financialEntriesSum: number
}

/**
 * Calcula o Wedding Score (0–100): uma métrica de quão avançado está o
 * planejamento do casamento. Decisão de produto (não recalcular sem alinhar):
 *
 * - 40% Checklist  — `checklistCompleted / checklistTotal`.
 * - 30% Convidados — `(confirmados + recusados) / total`. Mede o quanto a
 *   lista de convidados está "resolvida" (respondida), não só confirmações
 *   positivas — recusas também contam como resposta.
 * - 30% Saúde financeira, dividido em duas metades de 15%:
 *   - 15% se `budget` estiver preenchido (o casal definiu um teto de gastos);
 *   - 15% proporcionais a `financialEntriesSum / budget`, capado em 100% —
 *     recompensa quem já está rastreando os gastos, não só quem tem orçamento.
 *
 * Casos sem dado (0 convidados, 0 tarefas, sem orçamento) zeram o componente
 * correspondente em vez de gerar `NaN` ou dividir por zero.
 */
export function calculateWeddingScore(input: WeddingScoreInput): number {
  const {
    checklistTotal,
    checklistCompleted,
    guestsTotal,
    guestsResponded,
    budget,
    financialEntriesSum,
  } = input

  const checklistRatio = checklistTotal > 0 ? checklistCompleted / checklistTotal : 0
  const guestsRatio    = guestsTotal > 0 ? guestsResponded / guestsTotal : 0

  const hasBudget    = budget !== null && budget > 0
  const budgetSetPct = budget !== null ? 15 : 0
  const budgetUsedPct = hasBudget ? Math.min(financialEntriesSum / budget, 1) * 15 : 0

  const total =
    checklistRatio * 40 +
    guestsRatio * 30 +
    budgetSetPct +
    budgetUsedPct

  return Math.round(Math.min(100, Math.max(0, total)))
}
