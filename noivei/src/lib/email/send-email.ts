// Client de e-mail transacional do próprio app (RSVP, digest de tarefas atrasadas...).
//
// Importante: isso é INDEPENDENTE do SMTP configurado no painel do Supabase Auth.
// O SMTP do Supabase só serve para os e-mails de autenticação (confirmação de
// cadastro, redefinição de senha etc.) — não há como reaproveitá-lo para e-mails
// custom disparados pelo nosso próprio código, então usamos um transporte
// nodemailer separado, configurado por estas 5 variáveis de ambiente:
//
//   EMAIL_SMTP_HOST     — ex: smtp.gmail.com
//   EMAIL_SMTP_PORT     — ex: 587
//   EMAIL_SMTP_USER     — ex: wednest.suport@gmail.com
//   EMAIL_SMTP_PASSWORD — para Gmail, senha de APP (não a senha normal da conta)
//   EMAIL_FROM          — ex: "Wednest <wednest.suport@gmail.com>"
//
// Nenhuma dessas variáveis tem prefixo NEXT_PUBLIC_: e-mail só é disparado
// server-side (API routes / cron), nunca no browser.

import nodemailer from 'nodemailer'

interface SendEmailParams {
  to:      string
  subject: string
  html:    string
}

/**
 * Envia um e-mail transacional via SMTP.
 *
 * Se as variáveis de ambiente de e-mail não estiverem configuradas (ex: ambiente
 * de dev sem .env), apenas loga um aviso e retorna — nenhuma feature de e-mail
 * pode quebrar o fluxo principal (RSVP, cron) só porque o SMTP não está disponível.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const host     = process.env.EMAIL_SMTP_HOST
  const port     = process.env.EMAIL_SMTP_PORT
  const user     = process.env.EMAIL_SMTP_USER
  const password = process.env.EMAIL_SMTP_PASSWORD
  const from     = process.env.EMAIL_FROM

  if (!host || !port || !user || !password || !from) {
    console.warn('[email] SMTP não configurado — e-mail não enviado. Configure EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASSWORD e EMAIL_FROM.')
    return
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass: password },
  })

  await transporter.sendMail({ from, to, subject, html })
}
