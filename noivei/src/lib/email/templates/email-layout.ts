// Casca HTML compartilhada pelos templates de e-mail — mantém uma identidade visual
// simples e consistente (dourado do produto + fundo bege) sem tentar replicar a UI
// completa do app: e-mail precisa de HTML robusto para clientes variados (Gmail,
// Outlook...), então nada de Tailwind/CSS externo, só inline styles básicos.

// Formato de retorno comum a todos os templates de e-mail (rsvp-response-template,
// overdue-tasks-digest-template...).
export interface EmailTemplate {
  subject: string
  html:    string
}

interface EmailLayoutParams {
  title:      string
  bodyHtml:   string
  ctaLabel:   string
  ctaUrl:     string
}

export function emailLayout({ title, bodyHtml, ctaLabel, ctaUrl }: EmailLayoutParams): string {
  return `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#F7F1E6;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background-color:#F7F1E6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width:480px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background-color:#C6943A;padding:20px 32px;">
                <span style="color:#FFFFFF;font-size:18px;font-weight:bold;letter-spacing:0.04em;">Wednest</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#3A2A18;">
                <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#3A2A18;">${title}</h1>
                ${bodyHtml}
                <div style="margin-top:28px;">
                  <a href="${ctaUrl}" style="display:inline-block;background-color:#C6943A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">${ctaLabel}</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;color:#9A8A70;font-size:12px;">
                Você recebeu este e-mail porque ativou notificações por e-mail no Wednest.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim()
}
