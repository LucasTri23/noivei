// Funções puras, sem efeitos colaterais além do cálculo

/** Chave de cada um dos 7 módulos que compõem o Wedding Score completo. */
export type WeddingScoreModuleKey =
  | 'checklist'
  | 'financeiro'
  | 'convidados'
  | 'rsvp'
  | 'mesas'
  | 'presentes'
  | 'arquivos'

export interface WeddingScoreModulePcts {
  /** `checklistCompleted / checklistTotal` */
  checklist:  number
  /** 50% se `budget` estiver preenchido + até 50% proporcional a `financialEntriesSum / budget` */
  financeiro: number
  /** `convidadosCadastrados / weddings.guest_limit` (binário se `guest_limit` for `null`) */
  convidados: number
  /** `(confirmados + recusados) / convidadosCadastrados` */
  rsvp:       number
  /** `convidadosComMesaAtribuida / convidadosCadastrados` */
  mesas:      number
  /** `itensComprados / totalItensCadastrados` */
  presentes:  number
  /** binário: 100 se existir ao menos 1 arquivo, senão 0 */
  arquivos:   number
}

export interface WeddingScoreModuleBreakdown {
  module: WeddingScoreModuleKey
  label:  string
  pct:    number
  weight: number
}

export interface WeddingScoreResult {
  total:     number
  breakdown: WeddingScoreModuleBreakdown[]
}

/**
 * Calcula o Wedding Score (0–100): uma métrica de quão avançado está o
 * planejamento do casamento, composta por 7 módulos independentes (cada um já
 * calculado em 0–100 por quem chama esta function — ver `recalculate.ts` para as
 * fórmulas de cada `pct` a partir dos dados reais). Decisão de produto (não
 * recalcular sem alinhar):
 *
 * - Cada módulo entra com um PESO configurável (`wedding_score_module_weights`,
 *   editável em /admin/wedding-score) em vez de porcentagens fixas no código.
 * - O total é a MÉDIA PONDERADA dos 7 `pct`, normalizada pela SOMA REAL dos pesos
 *   informados — não pela constante 100. Isso protege o resultado contra pesos que
 *   somem diferente de 100 (a proporção relativa entre módulos continua correta,
 *   só a soma "nominal" pode não bater 100) e contra peso 0 (módulo não conta nada,
 *   sem precisar removê-lo da configuração).
 * - Se a soma de todos os pesos for 0 (ex.: admin zerou tudo por engano), o total
 *   é 0 em vez de dividir por zero.
 *
 * Cada módulo já vem protegido contra denominador 0 por quem calcula o `pct`
 * (ver `recalculate.ts`) — esta function só combina os 7 números, sem tocar em
 * banco de dados, o que a mantém pura e fácil de testar.
 */
export function calculateWeddingScore(
  pcts:    WeddingScoreModulePcts,
  weights: Record<WeddingScoreModuleKey, number>,
  labels:  Record<WeddingScoreModuleKey, string>,
): WeddingScoreResult {
  const modules: WeddingScoreModuleKey[] = [
    'checklist', 'financeiro', 'convidados', 'rsvp', 'mesas', 'presentes', 'arquivos',
  ]

  const totalWeight = modules.reduce((sum, module) => sum + (weights[module] ?? 0), 0)

  const breakdown: WeddingScoreModuleBreakdown[] = modules.map((module) => ({
    module,
    label:  labels[module] ?? module,
    pct:    clampPct(pcts[module]),
    weight: weights[module] ?? 0,
  }))

  const weightedSum = totalWeight > 0
    ? breakdown.reduce((sum, item) => sum + (item.pct * item.weight) / totalWeight, 0)
    : 0

  return {
    total: Math.round(Math.min(100, Math.max(0, weightedSum))),
    breakdown,
  }
}

// Cada `pct` já deveria vir 0-100 de quem calcula (recalculate.ts), mas protege
// contra valor fora da faixa (ex.: arredondamento acumulado) sem gerar NaN.
function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0
  return Math.min(100, Math.max(0, pct))
}
