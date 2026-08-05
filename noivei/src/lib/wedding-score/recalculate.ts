import type { SupabaseClient } from '@supabase/supabase-js'
import type { GuestStatus } from '@/types/database'
import { createSupabaseService } from '@/lib/supabase/service'
import {
  calculateWeddingScore,
  type WeddingScoreModuleKey,
  type WeddingScoreModulePcts,
  type WeddingScoreResult,
} from '@/lib/wedding-score/calculator'

const RESPONDED_STATUSES: GuestStatus[] = ['confirmado', 'recusado']

const MODULE_KEYS: WeddingScoreModuleKey[] = [
  'checklist', 'financeiro', 'convidados', 'rsvp', 'mesas', 'presentes', 'arquivos',
]

/**
 * Busca os dados reais necessários pros 7 módulos (checklist, financeiro,
 * convidados, RSVP, mesas, presentes, arquivos), calcula o Wedding Score via
 * `calculateWeddingScore` e persiste o resultado em `weddings.wedding_score` /
 * `weddings.score_calculated_at` (compatibilidade com quem já lê essa coluna) e
 * em `wedding_score_history` (uma linha por casamento por dia, upsert).
 *
 * Barato o suficiente para rodar a cada carregamento do Dashboard (poucas queries
 * agregadas, sem N+1).
 *
 * Defesa em profundidade: confere `fn_has_module_access(weddingId, userId,
 * 'wedding_score')` antes de qualquer query e retorna cedo (`null`, sem gastar
 * as queries nem persistir nada) se o módulo não estiver liberado — mesmo
 * espírito de "não processar o que não vai ser mostrado" já usado no resto do
 * app. Quem chama esta function (Dashboard) já faz sua própria checagem de
 * plano+módulo antes de decidir renderizar o card; esta é só uma segunda camada,
 * redundante de propósito (mesmo padrão de `requireWeddingOwnership` etc.).
 */
export async function recalculateWeddingScore(
  supabase:  SupabaseClient,
  weddingId: string,
  userId:    string,
): Promise<WeddingScoreResult | null> {
  const { data: hasAccess, error: accessError } = await supabase
    .rpc('fn_has_module_access', { p_wedding_id: weddingId, p_user_id: userId, p_module: 'wedding_score' })

  if (accessError || !hasAccess) return null

  const [
    { data: weightRows },
    { data: checklistItems },
    { data: guests },
    { data: wedding },
    { data: financialEntries },
    { count: guestsWithTableCount },
    { data: giftItems },
    { count: filesCount },
  ] = await Promise.all([
    supabase
      .from('wedding_score_module_weights')
      .select('module_key, label, weight'),
    supabase
      .from('checklist_items')
      .select('completed')
      .eq('wedding_id', weddingId)
      .eq('is_archived', false)
      .eq('is_dismissed', false),
    supabase
      .from('guests')
      .select('status')
      .eq('wedding_id', weddingId),
    supabase
      .from('weddings')
      .select('budget, guest_limit')
      .eq('id', weddingId)
      .maybeSingle(),
    supabase
      .from('financial_entries')
      .select('total_amount')
      .eq('wedding_id', weddingId),
    // table_assignments não tem wedding_id próprio — vínculo é via guest_id ->
    // guests.wedding_id. Usa embed !inner pra filtrar na própria query (mesma
    // técnica já usada em export/route.ts, ali via tables_config!inner).
    supabase
      .from('table_assignments')
      .select('guest_id, guests!inner(wedding_id)', { count: 'exact', head: true })
      .eq('guests.wedding_id', weddingId),
    supabase
      .from('gift_registry_items')
      .select('is_purchased')
      .eq('wedding_id', weddingId),
    supabase
      .from('wedding_files')
      .select('id', { count: 'exact', head: true })
      .eq('wedding_id', weddingId),
  ])

  const checklist   = (checklistItems ?? [])     as { completed: boolean }[]
  const guestList   = (guests ?? [])             as { status: GuestStatus }[]
  const entries     = (financialEntries ?? [])   as { total_amount: number }[]
  const giftList    = (giftItems ?? [])          as { is_purchased: boolean }[]
  const budget      = (wedding?.budget as number | null | undefined) ?? null
  const guestLimit  = (wedding?.guest_limit as number | null | undefined) ?? null

  const checklistTotal     = checklist.length
  const checklistCompleted = checklist.filter((item) => item.completed).length
  const guestsTotal        = guestList.length
  const guestsResponded    = guestList.filter((guest) => RESPONDED_STATUSES.includes(guest.status)).length
  const guestsWithTable    = guestsWithTableCount ?? 0
  const financialEntriesSum = entries.reduce((sum, entry) => sum + (entry.total_amount ?? 0), 0)
  const giftTotal      = giftList.length
  const giftPurchased  = giftList.filter((item) => item.is_purchased).length
  const hasFiles       = (filesCount ?? 0) > 0

  const pcts: WeddingScoreModulePcts = {
    checklist:  checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0,
    financeiro: calculateFinanceiroPct(budget, financialEntriesSum),
    convidados: calculateConvidadosPct(guestsTotal, guestLimit),
    rsvp:       guestsTotal > 0 ? (guestsResponded / guestsTotal) * 100 : 0,
    mesas:      guestsTotal > 0 ? (guestsWithTable / guestsTotal) * 100 : 0,
    presentes:  giftTotal > 0 ? (giftPurchased / giftTotal) * 100 : 0,
    // Sem "meta" real de quantidade de arquivos pra fazer proporção — binário
    // intencional: 100 se existir ao menos 1 arquivo, senão 0.
    arquivos:   hasFiles ? 100 : 0,
  }

  const weights: Record<WeddingScoreModuleKey, number> = Object.fromEntries(
    MODULE_KEYS.map((key) => [key, 0]),
  ) as Record<WeddingScoreModuleKey, number>
  const labels: Record<WeddingScoreModuleKey, string> = Object.fromEntries(
    MODULE_KEYS.map((key) => [key, key]),
  ) as Record<WeddingScoreModuleKey, string>

  for (const row of (weightRows ?? []) as { module_key: WeddingScoreModuleKey; label: string; weight: number }[]) {
    weights[row.module_key] = Number(row.weight)
    labels[row.module_key]  = row.label
  }

  const result: WeddingScoreResult = calculateWeddingScore(pcts, weights, labels)

  await supabase
    .from('weddings')
    .update({ wedding_score: result.total, score_calculated_at: new Date().toISOString() })
    .eq('id', weddingId)

  // wedding_score_history não tem policy de INSERT/UPDATE pra cliente autenticado
  // (só o servidor escreve) — usa o client service role, que ignora RLS.
  const pctByModule = Object.fromEntries(
    result.breakdown.map((item) => [item.module, item.pct]),
  ) as Record<WeddingScoreModuleKey, number>

  const serviceClient = createSupabaseService()
  await serviceClient
    .from('wedding_score_history')
    .upsert(
      {
        wedding_id:     weddingId,
        score:          result.total,
        checklist_pct:  pctByModule.checklist,
        financeiro_pct: pctByModule.financeiro,
        convidados_pct: pctByModule.convidados,
        rsvp_pct:       pctByModule.rsvp,
        mesas_pct:      pctByModule.mesas,
        presentes_pct:  pctByModule.presentes,
        arquivos_pct:   pctByModule.arquivos,
      },
      { onConflict: 'wedding_id,recorded_date' },
    )

  return result
}

// 50% se `budget` estiver preenchido (não-nulo), mais até 50% proporcional a
// `financialEntriesSum / budget`, capado em 100% — protege contra budget nulo/0
// (nunca divide por zero).
function calculateFinanceiroPct(budget: number | null, financialEntriesSum: number): number {
  const budgetSetPct  = budget !== null ? 50 : 0
  const hasBudget     = budget !== null && budget > 0
  const budgetUsedPct = hasBudget ? Math.min(financialEntriesSum / budget, 1) * 50 : 0
  return budgetSetPct + budgetUsedPct
}

// `guest_limit` é a estimativa de convidados informada no onboarding — pode ser
// `null` (casal não informou). Sem denominador real, trata como binário: 100 se
// já existe pelo menos 1 convidado cadastrado, senão 0.
function calculateConvidadosPct(guestsTotal: number, guestLimit: number | null): number {
  if (guestLimit === null || guestLimit <= 0) {
    return guestsTotal > 0 ? 100 : 0
  }
  return Math.min(guestsTotal / guestLimit, 1) * 100
}
