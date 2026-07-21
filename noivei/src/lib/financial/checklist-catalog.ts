import type { FinancialQuoteType } from '@/types/database'

// Tarefas do Checklist marcadas automaticamente quando um orçamento daquele tipo é
// selecionado (rota .../financial-quotes/[id]/select) e desmarcadas de volta quando o
// lançamento gerado é excluído (rota .../financial/[id] DELETE). Só "local" e "buffet"
// têm tarefa mapeada por enquanto — os demais tipos não afetam o Checklist.
export const CHECKLIST_CATALOG_KEY_BY_TYPE: Partial<Record<FinancialQuoteType, string>> = {
  local:  'planejamento.reservar-local',
  buffet: 'festa.cardapio-buffet',
}
