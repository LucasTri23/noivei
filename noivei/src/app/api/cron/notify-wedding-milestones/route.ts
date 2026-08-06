// Cron diário: avisa por e-mail o dono de cada casamento com plano pago sobre
// marcos importantes da data do casamento — 30 dias antes, 7 dias antes, véspera,
// no dia, e um agradecimento no dia seguinte. Protegida por CRON_SECRET — sem
// essa checagem, qualquer um poderia chamar essa rota publicamente e forçar
// disparo de e-mail em massa pra todos os casamentos.
//
// A Vercel já envia o CRON_SECRET automaticamente como `Authorization: Bearer
// {CRON_SECRET}` em cron jobs nativos dela (configurados em vercel.json) — basta
// configurar a env var CRON_SECRET no projeto, nenhum código extra é necessário
// pro agendamento em si.

import type { SupabaseClient } from '@supabase/supabase-js'
import { err, handleApiError, ok } from '@/lib/api/response'
import { isPaidPlan } from '@/constants/plans'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { sendEmail, type SendEmailAttachment } from '@/lib/email/send-email'
import { weddingMilestoneTemplate, type WeddingMilestone } from '@/lib/email/templates/wedding-milestone-template'
import { renderWeddingSummaryPdf, type WeddingSummaryPdfData, type WeddingSummaryScore } from '@/lib/pdf/wedding-summary-pdf'
import { constantTimeEqual } from '@/lib/security/constant-time-compare'
import { createSupabaseService } from '@/lib/supabase/service'
import type { GuestStatus } from '@/types/database'

// @react-pdf/renderer (renderWeddingSummaryPdf) precisa do runtime Node — deixar
// implícito já bastaria hoje, mas fixar explicitamente evita quebra silenciosa
// caso o runtime padrão de rotas mude no futuro.
export const runtime = 'nodejs'

// yyyy-mm-dd, yyyy-mm-dd → diferença inteira de dias (toISO - fromISO) usando
// Date.UTC pros dois lados — as strings já são datas puras (America/Sao_Paulo,
// resolvidas pelo caller), então isso nunca sofre off-by-one por fuso/DST.
function daysBetween(fromISO: string, toISO: string): number {
  const [fy = 0, fm = 1, fd = 1] = fromISO.split('-').map(Number)
  const [ty = 0, tm = 1, td = 1] = toISO.split('-').map(Number)
  const fromUTC = Date.UTC(fy, fm - 1, fd)
  const toUTC = Date.UTC(ty, tm - 1, td)
  return Math.round((toUTC - fromUTC) / 86_400_000)
}

// Cada marco dispara em uma diferença de dias exata — o cron roda uma vez por
// dia, então cada casamento recebe cada e-mail exatamente uma vez.
function resolveMilestone(daysUntilWedding: number): WeddingMilestone | null {
  switch (daysUntilWedding) {
    case 30: return 'days_30'
    case 7:  return 'days_7'
    case 1:  return 'day_before'
    case 0:  return 'wedding_day'
    case -1: return 'day_after'
    default: return null
  }
}

// Módulos do Wedding Score, na ordem exibida no PDF — mesma ordem de
// `wedding-score/calculator.ts` (checklist, financeiro, convidados, rsvp, mesas,
// presentes, arquivos), pra o resumo bater com o que o casal vê no Dashboard.
const SCORE_MODULE_ORDER = ['checklist', 'financeiro', 'convidados', 'rsvp', 'mesas', 'presentes', 'arquivos'] as const

// Busca os dados "crus" do resumo do casamento (checklist, convidados, financeiro,
// presentes, arquivos) pro PDF anexado no e-mail do marco `day_after`. Se o módulo
// Wedding Score estiver liberado (`fn_has_module_access`) e já tiver sido
// calculado alguma vez, reaproveita o resultado já persistido em
// `weddings.wedding_score` / `wedding_score_history` — não recalcula aqui, isso é
// responsabilidade de `wedding-score/recalculate.ts` (chamado pelo Dashboard).
// Sempre filtrado por `weddingId`: nunca mistura dado de outro casamento.
async function buildWeddingSummaryPdfData(
  supabase:       SupabaseClient,
  weddingId:      string,
  userId:         string,
  coupleNames:    string,
  weddingDateISO: string,
): Promise<WeddingSummaryPdfData> {
  const [
    { data: checklistItems },
    { data: guests },
    { data: wedding },
    { data: financialEntries },
    { data: giftItems },
    { count: filesCount },
    { data: hasScoreAccess },
  ] = await Promise.all([
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
      .select('budget, wedding_score, score_calculated_at')
      .eq('id', weddingId)
      .maybeSingle(),
    supabase
      .from('financial_entries')
      .select('total_amount')
      .eq('wedding_id', weddingId),
    supabase
      .from('gift_registry_items')
      .select('is_purchased')
      .eq('wedding_id', weddingId),
    supabase
      .from('wedding_files')
      .select('id', { count: 'exact', head: true })
      .eq('wedding_id', weddingId),
    supabase.rpc('fn_has_module_access', { p_wedding_id: weddingId, p_user_id: userId, p_module: 'wedding_score' }),
  ])

  const checklist = (checklistItems ?? []) as { completed: boolean }[]
  const guestList = (guests ?? []) as { status: GuestStatus }[]
  const entries   = (financialEntries ?? []) as { total_amount: number }[]
  const giftList  = (giftItems ?? []) as { is_purchased: boolean }[]

  const budgetCents     = (wedding?.budget as number | null | undefined) ?? null
  const totalSpentCents = entries.reduce((sum, entry) => sum + (entry.total_amount ?? 0), 0)

  let score: WeddingSummaryScore | null = null

  // "Dados já calculados": só monta o card de score se o módulo estiver liberado
  // E já existir um cálculo persistido (score_calculated_at) — sem os dois, o
  // resumo segue sem essa seção, mas nunca quebra por causa dela.
  if (hasScoreAccess && wedding?.score_calculated_at) {
    const [{ data: historyRow }, { data: weightRows }] = await Promise.all([
      supabase
        .from('wedding_score_history')
        .select('checklist_pct, financeiro_pct, convidados_pct, rsvp_pct, mesas_pct, presentes_pct, arquivos_pct')
        .eq('wedding_id', weddingId)
        .order('recorded_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('wedding_score_module_weights')
        .select('module_key, label'),
    ])

    if (historyRow) {
      const labelByModule = Object.fromEntries(
        ((weightRows ?? []) as { module_key: string; label: string }[]).map((row) => [row.module_key, row.label]),
      )
      const pctByModule = historyRow as Record<string, number>

      score = {
        total: (wedding.wedding_score as number | null) ?? 0,
        breakdown: SCORE_MODULE_ORDER.map((moduleKey) => ({
          label: labelByModule[moduleKey] ?? moduleKey,
          pct:   pctByModule[`${moduleKey}_pct`] ?? 0,
        })),
      }
    }
  }

  return {
    coupleNames,
    weddingDate: weddingDateISO,
    checklist: {
      completed: checklist.filter((item) => item.completed).length,
      total:     checklist.length,
    },
    guests: {
      total:     guestList.length,
      confirmed: guestList.filter((guest) => guest.status === 'confirmado').length,
      declined:  guestList.filter((guest) => guest.status === 'recusado').length,
      pending:   guestList.filter((guest) => guest.status === 'pendente').length,
    },
    financial: { budgetCents, totalSpentCents },
    gifts: {
      purchased: giftList.filter((item) => item.is_purchased).length,
      total:     giftList.length,
    },
    files: { count: filesCount ?? 0 },
    score,
  }
}

export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization')

    if (!secret || !authHeader || !constantTimeEqual(authHeader, `Bearer ${secret}`)) {
      return err(401, 'UNAUTHORIZED', 'Não autorizado.')
    }

    const supabase = createSupabaseService()

    // "Hoje" em America/Sao_Paulo — produto Brasil-only, e a diferença de dias
    // precisa bater com o fuso do casal, não com o fuso do servidor (Vercel roda
    // em UTC), senão o marco dispara no dia errado.
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

    // Restringe a busca a uma janela [ontem, +30 dias] em vez de varrer todo
    // casamento ativo — os únicos marcos possíveis caem dentro dela.
    const rangeStart = new Date()
    rangeStart.setDate(rangeStart.getDate() - 1)
    const rangeEnd = new Date()
    rangeEnd.setDate(rangeEnd.getDate() + 30)
    const rangeStartStr = rangeStart.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const rangeEndStr = rangeEnd.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

    const { data: weddings, error: weddingsError } = await supabase
      .from('weddings')
      .select('id, user_id, couple_names, wedding_date')
      .is('deleted_at', null)
      .gte('wedding_date', rangeStartStr)
      .lte('wedding_date', rangeEndStr)

    if (weddingsError) return err(500, 'DB_ERROR', 'Erro ao buscar casamentos.')

    let sent = 0

    for (const wedding of (weddings ?? []) as { id: string; user_id: string; couple_names: string; wedding_date: string }[]) {
      try {
        const milestone = resolveMilestone(daysBetween(today, wedding.wedding_date))
        if (!milestone) continue

        const planId = await resolveWeddingPlanId(supabase, wedding.id)
        if (!isPaidPlan(planId)) continue

        const { data: profile } = await supabase
          .from('profiles')
          .select('notify_milestones')
          .eq('id', wedding.user_id)
          .maybeSingle()

        const notifyMilestones = (profile?.notify_milestones as boolean | undefined) ?? true
        if (!notifyMilestones) continue

        const { data: userData } = await supabase.auth.admin.getUserById(wedding.user_id)
        const ownerEmail = userData.user?.email
        if (!ownerEmail) continue

        const { subject, html } = weddingMilestoneTemplate({
          coupleNames: wedding.couple_names,
          milestone,
        })

        // Só o marco day_after leva anexo — geração de PDF é uma operação mais
        // pesada, isolada num try/catch próprio: se falhar por qualquer motivo,
        // o e-mail ainda deve ser enviado (sem o anexo), nunca cancelado por
        // causa disso.
        let attachments: SendEmailAttachment[] | undefined
        if (milestone === 'day_after') {
          try {
            const summaryData = await buildWeddingSummaryPdfData(
              supabase,
              wedding.id,
              wedding.user_id,
              wedding.couple_names,
              wedding.wedding_date,
            )
            const pdfBuffer = await renderWeddingSummaryPdf(summaryData)
            attachments = [{ filename: 'resumo-casamento.pdf', content: pdfBuffer }]
          } catch (pdfError) {
            console.error(`[cron/notify-wedding-milestones] falha ao gerar PDF de resumo do casamento ${wedding.id}:`, pdfError)
          }
        }

        await sendEmail({ to: ownerEmail, subject, html, attachments })
        sent += 1
      } catch (error) {
        console.error(`[cron/notify-wedding-milestones] falha ao processar casamento ${wedding.id}:`, error)
      }
    }

    return ok({ processed: weddings?.length ?? 0, sent })
  } catch (error) {
    return handleApiError(error)
  }
}
