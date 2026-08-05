import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendMailMock = vi.fn().mockResolvedValue(undefined)
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }))

vi.mock('nodemailer', () => ({
  default: { createTransport: () => createTransportMock() },
}))

import { sendEmail } from './send-email'

const ORIGINAL_ENV = { ...process.env }

describe('sendEmail', () => {
  beforeEach(() => {
    sendMailMock.mockClear()
    createTransportMock.mockClear()
    process.env.EMAIL_SMTP_HOST = 'smtp.example.com'
    process.env.EMAIL_SMTP_PORT = '587'
    process.env.EMAIL_SMTP_USER = 'user@example.com'
    process.env.EMAIL_SMTP_PASSWORD = 'app-password'
    process.env.EMAIL_FROM = 'Wednest <wednest@example.com>'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('deve enviar e-mail sem attachments quando o parâmetro não é informado', async () => {
    await sendEmail({ to: 'casal@example.com', subject: 'Assunto', html: '<p>Olá</p>' })

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to:      'casal@example.com',
        subject: 'Assunto',
        html:    '<p>Olá</p>',
        attachments: undefined,
      }),
    )
  })

  it('deve repassar attachments para transporter.sendMail quando informado', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.7 conteúdo fake')

    await sendEmail({
      to:      'casal@example.com',
      subject: 'Parabéns pelo casamento!',
      html:    '<p>Resumo em anexo</p>',
      attachments: [{ filename: 'resumo-casamento.pdf', content: pdfBuffer }],
    })

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ filename: 'resumo-casamento.pdf', content: pdfBuffer }],
      }),
    )
  })

  it('não deve enviar e-mail quando o SMTP não está configurado', async () => {
    delete process.env.EMAIL_SMTP_HOST

    await sendEmail({ to: 'casal@example.com', subject: 'Assunto', html: '<p>Olá</p>' })

    expect(sendMailMock).not.toHaveBeenCalled()
  })
})
