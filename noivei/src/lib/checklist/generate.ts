// Motor de regras: materializa o catálogo em checklist_items conforme os fatos do casal.
// Idempotente — pode rodar quantas vezes for preciso (onboarding e re-execução ao mudar respostas).
// Regras de re-execução (§2/§8 do doc): tarefa concluída nunca some, só arquiva.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { CHECKLIST_CATALOG, resolveOffsetDays, resolvePhase, type CatalogTask } from './catalog'
import type { WeddingFacts } from './facts'

interface ExistingItem {
  id: string
  catalog_key: string | null
  completed: boolean
  is_archived: boolean
}

/**
 * Calcula a due_date subtraindo offsetDays da data do casamento.
 * Offset negativo = tarefa pós-casamento. Sem data ou sem offset → null.
 */
export function calcDueDate(weddingDate: string | null, offsetDays: number | null): string | null {
  if (!weddingDate || offsetDays === null) return null
  const [y, m, d] = weddingDate.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - offsetDays)
  return date.toISOString().slice(0, 10)
}

/**
 * Núcleo idempotente da sincronização: percorre o catálogo aplicando o predicado
 * `isActive` a cada tarefa e materializa o resultado em checklist_items:
 * - ativa: insere se não existir (idempotência via catalog_key); desarquiva se arquivada.
 * - inativa: deleta se pendente; arquiva se concluída (mantém histórico).
 * Compartilhado entre a geração personalizada (condições do questionário) e a
 * checklist fixa do plano Gratuito (só tarefas incondicionais — generate-free.ts).
 */
export async function syncCatalogItems(
  supabase: SupabaseClient<Database>,
  weddingId: string,
  facts: WeddingFacts,
  weddingDate: string | null,
  isActive: (task: CatalogTask) => boolean,
): Promise<void> {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('id, catalog_key, completed, is_archived')
    .eq('wedding_id', weddingId)
    .not('catalog_key', 'is', null)

  if (error) throw error

  const existingByKey = new Map<string, ExistingItem>(
    ((data ?? []) as ExistingItem[]).map((row) => [row.catalog_key as string, row]),
  )

  const inserts: Record<string, unknown>[] = []
  const unarchiveIds: string[] = []
  const archiveIds: string[] = []
  const deleteIds: string[] = []

  CHECKLIST_CATALOG.forEach((task, index) => {
    const active = isActive(task)
    const existing = existingByKey.get(task.key)

    if (active) {
      if (!existing) {
        inserts.push({
          wedding_id: weddingId,
          label: task.label,
          category: task.category,
          phase: resolvePhase(task, facts),
          catalog_key: task.key,
          due_date: calcDueDate(weddingDate, resolveOffsetDays(task, facts)),
          sort_order: index,
        })
      } else if (existing.is_archived) {
        unarchiveIds.push(existing.id)
      }
      return
    }

    if (!existing) return
    if (existing.completed) {
      if (!existing.is_archived) archiveIds.push(existing.id)
    } else {
      deleteIds.push(existing.id)
    }
  })

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from('checklist_items').insert(inserts)
    if (insertError) throw insertError
  }

  if (unarchiveIds.length > 0) {
    const { error: unarchiveError } = await supabase
      .from('checklist_items')
      .update({ is_archived: false })
      .in('id', unarchiveIds)
    if (unarchiveError) throw unarchiveError
  }

  if (archiveIds.length > 0) {
    const { error: archiveError } = await supabase
      .from('checklist_items')
      .update({ is_archived: true })
      .in('id', archiveIds)
    if (archiveError) throw archiveError
  }

  if (deleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('checklist_items')
      .delete()
      .in('id', deleteIds)
    if (deleteError) throw deleteError
  }
}

/**
 * Geração personalizada (planos pagos): avalia as condições do catálogo sobre os
 * fatos do casal (respostas Q1–Q24) e sincroniza checklist_items.
 */
export async function generateChecklistItems(
  supabase: SupabaseClient<Database>,
  weddingId: string,
  facts: WeddingFacts,
  weddingDate: string | null,
): Promise<void> {
  await syncCatalogItems(supabase, weddingId, facts, weddingDate, (task) => task.condition(facts))
}
