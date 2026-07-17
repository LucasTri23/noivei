// Checklist fixa do plano Gratuito: só as tarefas incondicionais do catálogo
// (as marcadas como "sempre" no §4 de docs/checklist-rule-engine.md), sem passar
// pelo questionário de personalização — que é recurso dos planos pagos.
// Reaproveita o núcleo idempotente de generate.ts (upsert via catalog_key).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { isUnconditionalTask } from './catalog'
import { DEFAULT_ANSWERS, deriveFacts } from './facts'
import { syncCatalogItems } from './generate'

/**
 * Gera a checklist fixa/genérica para o casamento do plano Gratuito.
 * A due_date usa apenas weddings.wedding_date + o offset de cada tarefa
 * (nenhum fato do questionário entra no cálculo — tarefas incondicionais
 * têm fase e offset estáticos).
 */
export async function generateFreeChecklistItems(
  supabase: SupabaseClient<Database>,
  weddingId: string,
): Promise<void> {
  const { data: wedding, error } = await supabase
    .from('weddings')
    .select('wedding_date')
    .eq('id', weddingId)
    .single()

  if (error) throw error

  const weddingDate = (wedding?.wedding_date as string | null) ?? null
  // Fatos default ('nao_sei'/vazio) só para satisfazer resolvePhase/resolveOffsetDays —
  // tarefas incondicionais não dependem de nenhuma resposta.
  const facts = deriveFacts(DEFAULT_ANSWERS, weddingDate)

  await syncCatalogItems(supabase, weddingId, facts, weddingDate, isUnconditionalTask)
}
