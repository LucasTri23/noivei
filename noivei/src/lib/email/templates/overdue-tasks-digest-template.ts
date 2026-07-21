import { APP_URL } from '@/lib/email/app-url'
import { emailLayout, type EmailTemplate } from '@/lib/email/templates/email-layout'

interface OverdueTask {
  label:    string
  category: string | null
  dueDate:  string
}

interface OverdueTasksDigestTemplateParams {
  coupleNames: string
  tasks:       OverdueTask[]
}

// yyyy-mm-dd → dd/mm/yyyy sem passar por Date UTC (evita off-by-one de fuso)
function formatDueDate(dueDate: string): string {
  const [y, m, d] = dueDate.split('-').map(Number)
  if (!y || !m || !d) return dueDate
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function overdueTasksDigestTemplate({ coupleNames, tasks }: OverdueTasksDigestTemplateParams): EmailTemplate {
  const subject = tasks.length === 1
    ? '1 tarefa do checklist está atrasada'
    : `${tasks.length} tarefas do checklist estão atrasadas`

  const itemsHtml = tasks
    .map((task) => `
      <li style="margin-bottom:10px;font-size:14px;line-height:1.5;">
        <strong>${task.label}</strong>${task.category ? ` <span style="color:#9A8A70;">(${task.category})</span>` : ''}
        <br />
        <span style="color:#C0553F;">Venceu em ${formatDueDate(task.dueDate)}</span>
      </li>
    `)
    .join('')

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Olá, ${coupleNames}. Vocês têm ${tasks.length === 1 ? 'uma tarefa atrasada' : `${tasks.length} tarefas atrasadas`} no checklist do casamento:</p>
    <ul style="margin:0;padding-left:20px;">${itemsHtml}</ul>
  `

  const html = emailLayout({
    title: 'Tarefas atrasadas no checklist',
    bodyHtml,
    ctaLabel: 'Ver checklist',
    ctaUrl:   `${APP_URL}/checklist`,
  })

  return { subject, html }
}
