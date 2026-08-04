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

import { err, handleApiError, ok } from '@/lib/api/response'
import { isPaidPlan } from '@/constants/plans'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { sendEmail } from '@/lib/email/send-email'
import { weddingMilestoneTemplate, type WeddingMilestone } from '@/lib/email/templates/wedding-milestone-template'
import { createSupabaseService } from '@/lib/supabase/service'

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

export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization')

    if (!secret || authHeader !== `Bearer ${secret}`) {
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

        await sendEmail({ to: ownerEmail, subject, html })
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
