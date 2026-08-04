import { APP_URL } from '@/lib/email/app-url'
import { emailLayout, type EmailTemplate } from '@/lib/email/templates/email-layout'

interface MemberJoinedTemplateParams {
  coupleNames: string
  memberName:  string
}

export function memberJoinedTemplate({ coupleNames, memberName }: MemberJoinedTemplateParams): EmailTemplate {
  const subject = `${memberName} entrou como membro do seu casamento`

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Olá, ${coupleNames}!</p>
    <p style="margin:0;font-size:14px;line-height:1.6;"><strong>${memberName}</strong> aceitou o convite e agora tem acesso ao painel do casamento de vocês no Wednest.</p>
  `

  const html = emailLayout({
    title: 'Novo membro no casamento',
    bodyHtml,
    ctaLabel: 'Ver membros',
    ctaUrl:   `${APP_URL}/perfil/membros`,
  })

  return { subject, html }
}
