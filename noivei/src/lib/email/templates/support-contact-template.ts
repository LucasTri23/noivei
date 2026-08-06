import { emailLayout, type EmailTemplate } from '@/lib/email/templates/email-layout'

interface SupportContactTemplateParams {
  userEmail:   string
  coupleNames: string | null
  subject:     string
  message:     string
}

// Assunto e mensagem vêm de texto livre digitado pelo usuário no formulário de
// ajuda — diferente dos outros templates (rsvp-response, overdue-tasks...),
// que só interpolam nomes já validados em outro lugar, aqui precisa escapar
// antes de jogar no HTML do e-mail (evita que alguém injete markup/links no
// e-mail que chega na caixa de suporte).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function supportContactTemplate({ userEmail, coupleNames, subject, message }: SupportContactTemplateParams): EmailTemplate {
  const safeSubject = escapeHtml(subject)
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />')
  const safeEmail    = escapeHtml(userEmail)
  const safeCouple   = escapeHtml(coupleNames ?? 'sem casamento associado')

  const bodyHtml = `
    <p style="margin:0 0 4px;font-size:13px;color:#9A8A70;">De: <strong>${safeEmail}</strong> (${safeCouple})</p>
    <p style="margin:0 0 16px;font-size:13px;color:#9A8A70;">Assunto: <strong>${safeSubject}</strong></p>
    <p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${safeMessage}</p>
  `

  return {
    subject: `[Ajuda Wednest] ${subject}`,
    html: emailLayout({
      title:    'Nova mensagem pelo canal de ajuda',
      bodyHtml,
      ctaLabel: 'Responder por e-mail',
      ctaUrl:   `mailto:${userEmail}`,
    }),
  }
}
