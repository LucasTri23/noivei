// Motor de regras: materializa o catálogo em checklist_items conforme os fatos do casal.
// Idempotente — pode rodar quantas vezes for preciso (onboarding e re-execução ao mudar respostas).
// Regras de re-execução (§2/§8 do doc): tarefa concluída nunca some, só arquiva.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import { CHECKLIST_CATALOG, resolveOffsetDays, resolvePhase, type CatalogTask } from './catalog'
import { deriveFacts, parseAnswers, type WeddingFacts } from './facts'

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

/**
 * Recalcula due_date das tarefas do catálogo (catalog_key não nulo) quando a data do
 * casamento muda. Sem isso, alterar a data em Perfil > Dados do casamento não
 * atualizava os prazos já gerados — Checklist e Timeline continuavam com as datas
 * antigas, já que due_date só era calculado uma vez, na geração inicial.
 *
 * Tarefas avulsas (catalog_key null) não são tocadas — a data delas foi definida
 * manualmente pelo casal, é independente da data do casamento.
 */
export interface RecalculateResult {
  /** Quantas tarefas do catálogo existiam para esse casamento antes do recálculo. */
  total: number
  /** Quantas due_date foram efetivamente gravadas com sucesso. */
  updated: number
}

export async function recalculateChecklistDueDates(
  supabase: SupabaseClient<Database>,
  weddingId: string,
  newWeddingDate: string | null,
): Promise<RecalculateResult> {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('id, catalog_key')
    .eq('wedding_id', weddingId)
    .not('catalog_key', 'is', null)

  if (error) throw error

  const items = (data ?? []) as { id: string; catalog_key: string }[]
  if (items.length === 0) return { total: 0, updated: 0 }

  // Sem wedding_preferences (plano Gratuito, checklist fixa): recalcula com os fatos
  // default, mesmo padrão de generate-free.ts — tarefas incondicionais não dependem
  // de resposta nenhuma, só precisam da nova data.
  const { data: preferences } = await supabase
    .from('wedding_preferences')
    .select('answers')
    .eq('wedding_id', weddingId)
    .maybeSingle()

  const answers = parseAnswers(
    (preferences?.answers as Record<string, Json | undefined> | null | undefined) ?? null,
  )
  const facts = deriveFacts(answers, newWeddingDate)
  const catalogByKey = new Map(CHECKLIST_CATALOG.map((task) => [task.key, task]))

  // catalog_key de item existente sem correspondência no catálogo atual (chave renomeada/
  // removida entre uma geração e outra) — não há como recalcular esse item, mas isso não
  // pode ficar mudo: sem log, parece que a recalculação rodou certo quando na prática
  // pulou silenciosamente linhas inteiras.
  const orphanKeys = items
    .map((item) => item.catalog_key)
    .filter((key) => !catalogByKey.has(key))
  if (orphanKeys.length > 0) {
    console.warn(
      `[recalculateChecklistDueDates] ${orphanKeys.length} tarefa(s) com catalog_key sem correspondência no catálogo atual, due_date não recalculada:`,
      orphanKeys,
    )
  }

  const results = await Promise.all(
    items.map((item) => {
      const task = catalogByKey.get(item.catalog_key)
      if (!task) return null
      const due_date = calcDueDate(newWeddingDate, resolveOffsetDays(task, facts))
      return supabase.from('checklist_items').update({ due_date }).eq('id', item.id)
    }),
  )

  // .update() do Supabase não lança erro se a RLS simplesmente não afetar nenhuma linha —
  // sem checar `.error` aqui, uma falha (de permissão ou de rede) passava despercebida.
  const failed = results.filter(
    (result): result is NonNullable<typeof result> => result !== null && result.error !== null,
  )
  if (failed.length > 0) {
    console.error(
      `[recalculateChecklistDueDates] ${failed.length} atualização(ões) de due_date falharam:`,
      failed.map((result) => result.error),
    )
  }

  const attempted = items.length - orphanKeys.length
  return { total: items.length, updated: attempted - failed.length }
}
