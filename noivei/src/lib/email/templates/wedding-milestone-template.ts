import { APP_URL } from '@/lib/email/app-url'
import { emailLayout, type EmailTemplate } from '@/lib/email/templates/email-layout'

// Cada marco corresponde a uma diferença exata de dias entre hoje e wedding_date
// (calculada em America/Sao_Paulo pelo cron que dispara esse template — ver
// src/app/api/cron/notify-wedding-milestones/route.ts): 30 e 7 dias antes, a
// véspera, o próprio dia, e o dia seguinte (mensagem de encerramento/agradecimento).
export type WeddingMilestone = 'days_30' | 'days_7' | 'day_before' | 'wedding_day' | 'day_after'

interface WeddingMilestoneTemplateParams {
  coupleNames: string
  milestone:   WeddingMilestone
}

export function weddingMilestoneTemplate({ coupleNames, milestone }: WeddingMilestoneTemplateParams): EmailTemplate {
  switch (milestone) {
    case 'days_30':
      return {
        subject: 'Faltam 30 dias para o grande dia!',
        html: emailLayout({
          title: 'O grande dia está chegando',
          bodyHtml: `
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Olá, ${coupleNames}!</p>
            <p style="margin:0;font-size:14px;line-height:1.6;">Faltam apenas 30 dias para o casamento de vocês! É um ótimo momento para dar uma olhada no checklist e conferir se está tudo nos trilhos.</p>
          `,
          ctaLabel: 'Ver checklist',
          ctaUrl:   `${APP_URL}/checklist`,
        }),
      }

    case 'days_7':
      return {
        subject: 'Faltam só 7 dias para o casamento!',
        html: emailLayout({
          title: 'A reta final chegou',
          bodyHtml: `
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Olá, ${coupleNames}!</p>
            <p style="margin:0;font-size:14px;line-height:1.6;">Faltam só 7 dias! Essa é a reta final — vale a pena revisar o checklist, confirmar os últimos detalhes com fornecedores e conferir a lista de convidados.</p>
          `,
          ctaLabel: 'Ver checklist',
          ctaUrl:   `${APP_URL}/checklist`,
        }),
      }

    case 'day_before':
      return {
        subject: 'Amanhã é o grande dia!',
        html: emailLayout({
          title: 'Amanhã é o grande dia!',
          bodyHtml: `
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Olá, ${coupleNames}!</p>
            <p style="margin:0;font-size:14px;line-height:1.6;">Amanhã é o dia do casamento de vocês! Respirem fundo, aproveitem cada momento — o time Wednest está na torcida por vocês.</p>
          `,
          ctaLabel: 'Ver checklist',
          ctaUrl:   `${APP_URL}/checklist`,
        }),
      }

    case 'wedding_day':
      return {
        subject: 'Seu dia chegou! 💍',
        html: emailLayout({
          title: 'Seu dia chegou! 💍',
          bodyHtml: `
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Olá, ${coupleNames}!</p>
            <p style="margin:0;font-size:14px;line-height:1.6;">Hoje é o dia! Que seja um casamento repleto de amor, alegria e momentos inesquecíveis. Parabéns, de toda a equipe Wednest! 💍</p>
          `,
          ctaLabel: 'Abrir o Wednest',
          ctaUrl:   APP_URL,
        }),
      }

    case 'day_after':
      return {
        subject: 'Parabéns pelo casamento!',
        html: emailLayout({
          title: 'Parabéns pelo casamento!',
          bodyHtml: `
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Olá, ${coupleNames}!</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Parabéns pelo casamento! Esperamos que tenha sido um dia inesquecível. Se quiserem reviver os melhores momentos, deem uma olhada nas fotos que os convidados enviaram para o álbum do casamento.</p>
            <p style="margin:0;font-size:14px;line-height:1.6;">Preparamos também um resumo do planejamento de vocês em PDF, anexado a este e-mail.</p>
          `,
          ctaLabel: 'Ver álbum de fotos',
          ctaUrl:   `${APP_URL}/album`,
        }),
      }
  }
}
