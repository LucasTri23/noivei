// Digest diário: avisa por e-mail o dono de cada casamento com plano pago sobre
// tarefas do checklist atrasadas E tarefas vencendo nos próximos 7 dias ("alertas
// de que tá faltando coisa pra fazer ou coisa atrasada"). Protegida por CRON_SECRET
// — sem essa checagem, qualquer um poderia chamar essa rota publicamente e forçar
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
import { overdueTasksDigestTemplate } from '@/lib/email/templates/overdue-tasks-digest-template'
import { createSupabaseService } from '@/lib/supabase/service'

interface DigestTaskRow {
  label:     string
  category:  string | null
  due_date:  string
}

export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization')

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return err(401, 'UNAUTHORIZED', 'Não autorizado.')
    }

    const supabase = createSupabaseService()
    const today = new Date().toLocaleDateString('sv-SE') // yyyy-mm-dd

    const in7Days = new Date()
    in7Days.setDate(in7Days.getDate() + 7)
    const in7DaysStr = in7Days.toLocaleDateString('sv-SE') // yyyy-mm-dd

    const { data: weddings, error: weddingsError } = await supabase
      .from('weddings')
      .select('id, user_id, couple_names')
      .is('deleted_at', null)
      .gt('wedding_date', today)

    if (weddingsError) return err(500, 'DB_ERROR', 'Erro ao buscar casamentos.')

    let sent = 0

    for (const wedding of (weddings ?? []) as { id: string; user_id: string; couple_names: string }[]) {
      const planId = await resolveWeddingPlanId(supabase, wedding.id)
      if (!isPaidPlan(planId)) continue

      const [{ data: overdueRows }, { data: upcomingRows }] = await Promise.all([
        supabase
          .from('checklist_items')
          .select('label, category, due_date')
          .eq('wedding_id', wedding.id)
          .eq('completed', false)
          .eq('is_archived', false)
          .eq('is_dismissed', false)
          .lt('due_date', today),
        supabase
          .from('checklist_items')
          .select('label, category, due_date')
          .eq('wedding_id', wedding.id)
          .eq('completed', false)
          .eq('is_archived', false)
          .eq('is_dismissed', false)
          .gte('due_date', today)
          .lte('due_date', in7DaysStr),
      ])

      const overdueTasks  = (overdueRows ?? []) as DigestTaskRow[]
      const upcomingTasks = (upcomingRows ?? []) as DigestTaskRow[]
      if (overdueTasks.length === 0 && upcomingTasks.length === 0) continue

      const { data: profile } = await supabase
        .from('profiles')
        .select('notify_timeline')
        .eq('id', wedding.user_id)
        .maybeSingle()

      const notifyTimeline = (profile?.notify_timeline as boolean | undefined) ?? true
      if (!notifyTimeline) continue

      const { data: userData } = await supabase.auth.admin.getUserById(wedding.user_id)
      const ownerEmail = userData.user?.email
      if (!ownerEmail) continue

      const { subject, html } = overdueTasksDigestTemplate({
        coupleNames: wedding.couple_names,
        overdueTasks: overdueTasks.map((task) => ({
          label:    task.label,
          category: task.category,
          dueDate:  task.due_date,
        })),
        upcomingTasks: upcomingTasks.map((task) => ({
          label:    task.label,
          category: task.category,
          dueDate:  task.due_date,
        })),
      })

      try {
        await sendEmail({ to: ownerEmail, subject, html })
        sent += 1
      } catch (error) {
        console.error(`[cron/notify-overdue] falha ao enviar e-mail pro casamento ${wedding.id}:`, error)
      }
    }

    return ok({ processed: weddings?.length ?? 0, sent })
  } catch (error) {
    return handleApiError(error)
  }
}
