import { APP_URL } from '@/lib/email/app-url'
import { emailLayout, type EmailTemplate } from '@/lib/email/templates/email-layout'

// Só 'confirmado' e 'recusado' geram e-mail — 'pendente' (status inicial do
// convidado, sem resposta ainda) nunca dispara notificação.
export type RsvpEmailStatus = 'confirmado' | 'recusado'

interface RsvpResponseTemplateParams {
  coupleNames: string
  guestName:   string
  status:      RsvpEmailStatus
}

export function rsvpResponseTemplate({ coupleNames, guestName, status }: RsvpResponseTemplateParams): EmailTemplate {
  const confirmed = status === 'confirmado'

  const subject = confirmed
    ? `${guestName} confirmou presença!`
    : `${guestName} não poderá comparecer`

  const bodyHtml = confirmed
    ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Boa notícia, ${coupleNames}!</p>
       <p style="margin:0;font-size:14px;line-height:1.6;"><strong>${guestName}</strong> confirmou presença no casamento de vocês.</p>`
    : `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Olá, ${coupleNames}.</p>
       <p style="margin:0;font-size:14px;line-height:1.6;"><strong>${guestName}</strong> avisou que não poderá comparecer ao casamento.</p>`

  const html = emailLayout({
    title:    confirmed ? 'Presença confirmada' : 'Resposta de RSVP',
    bodyHtml,
    ctaLabel: 'Ver convidados',
    ctaUrl:   `${APP_URL}/convidados`,
  })

  return { subject, html }
}
