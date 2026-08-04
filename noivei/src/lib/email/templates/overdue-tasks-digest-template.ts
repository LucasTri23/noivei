import { APP_URL } from '@/lib/email/app-url'
import { emailLayout, type EmailTemplate } from '@/lib/email/templates/email-layout'

interface DigestTask {
  label:    string
  category: string | null
  dueDate:  string
}

interface OverdueTasksDigestTemplateParams {
  coupleNames:   string
  overdueTasks:  DigestTask[]
  upcomingTasks: DigestTask[]
}

// yyyy-mm-dd → dd/mm/yyyy sem passar por Date UTC (evita off-by-one de fuso)
function formatDueDate(dueDate: string): string {
  const [y, m, d] = dueDate.split('-').map(Number)
  if (!y || !m || !d) return dueDate
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function renderTaskList(tasks: DigestTask[], dateColor: string, datePrefix: string): string {
  return tasks
    .map((task) => `
      <li style="margin-bottom:10px;font-size:14px;line-height:1.5;">
        <strong>${task.label}</strong>${task.category ? ` <span style="color:#9A8A70;">(${task.category})</span>` : ''}
        <br />
        <span style="color:${dateColor};">${datePrefix} ${formatDueDate(task.dueDate)}</span>
      </li>
    `)
    .join('')
}

export function overdueTasksDigestTemplate({ coupleNames, overdueTasks, upcomingTasks }: OverdueTasksDigestTemplateParams): EmailTemplate {
  const hasOverdue  = overdueTasks.length > 0
  const hasUpcoming = upcomingTasks.length > 0

  const subject = hasOverdue
    ? (overdueTasks.length === 1 ? '1 tarefa do checklist está atrasada' : `${overdueTasks.length} tarefas do checklist estão atrasadas`)
    : (upcomingTasks.length === 1 ? '1 tarefa do checklist vence em breve' : `${upcomingTasks.length} tarefas do checklist vencem em breve`)

  const overdueSection = hasOverdue
    ? `
      <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">${overdueTasks.length === 1 ? 'Vocês têm uma tarefa atrasada' : `Vocês têm ${overdueTasks.length} tarefas atrasadas`} no checklist do casamento:</p>
      <ul style="margin:0 0 20px;padding-left:20px;">${renderTaskList(overdueTasks, '#C0553F', 'Venceu em')}</ul>
    `
    : ''

  const upcomingSection = hasUpcoming
    ? `
      <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">${upcomingTasks.length === 1 ? 'E há uma tarefa vencendo' : `E há ${upcomingTasks.length} tarefas vencendo`} nos próximos 7 dias:</p>
      <ul style="margin:0;padding-left:20px;">${renderTaskList(upcomingTasks, '#9A7B2E', 'Vence em')}</ul>
    `
    : ''

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Olá, ${coupleNames}.</p>
    ${overdueSection}
    ${upcomingSection}
  `

  const html = emailLayout({
    title: hasOverdue ? 'Tarefas do checklist precisam de atenção' : 'Tarefas do checklist vencendo em breve',
    bodyHtml,
    ctaLabel: 'Ver checklist',
    ctaUrl:   `${APP_URL}/checklist`,
  })

  return { subject, html }
}
