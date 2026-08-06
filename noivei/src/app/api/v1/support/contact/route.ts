import { requireAuth } from '@/lib/auth/require-auth'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { SupportContactSchema } from '@/lib/api/validation/support.schema'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/email/send-email'
import { supportContactTemplate } from '@/lib/email/templates/support-contact-template'

// Canal de ajuda dispara e-mail de verdade a partir de texto livre digitado
// pelo usuário — abusável como spam para a caixa de suporte se não tivesse
// rate limit (diferente das outras rotas de e-mail do produto, que só
// notificam sobre eventos do próprio sistema). Limite por usuário autenticado
// (não por e-mail informado — aqui é sempre o e-mail da própria sessão) e por
// IP, defesa em profundidade caso uma conta seja comprometida/scriptada.
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()

    const rateLimitSupabase = createSupabaseService()
    const ip = getClientIp(req)

    const userLimit = await checkRateLimit(rateLimitSupabase, `support-contact:user:${user.id}`, 5, 3600)
    if (!userLimit.allowed) {
      return err(429, 'RATE_LIMITED', 'Você atingiu o limite de mensagens por hora. Tente novamente mais tarde.')
    }

    const ipLimit = await checkRateLimit(rateLimitSupabase, `support-contact:ip:${ip}`, 10, 3600)
    if (!ipLimit.allowed) {
      return err(429, 'RATE_LIMITED', 'Você atingiu o limite de mensagens por hora. Tente novamente mais tarde.')
    }

    const body = await parseJsonBody(req)
    const parsed = SupportContactSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Revise os campos destacados e tente novamente.', parsed.error.flatten())
    }

    if (!user.email) {
      return err(400, 'MISSING_EMAIL', 'Sua conta não tem um e-mail associado.')
    }

    const supabase = await createSupabaseServer()
    const { data: wedding } = await supabase
      .from('weddings')
      .select('couple_names')
      .is('deleted_at', null)
      .order('created_at')
      .limit(1)
      .maybeSingle()

    const supportInbox = process.env.EMAIL_SMTP_USER
    if (!supportInbox) {
      console.error('[support/contact] EMAIL_SMTP_USER não configurado — mensagem não enviada.')
      return err(503, 'EMAIL_NOT_CONFIGURED', 'Canal de e-mail indisponível no momento. Tente novamente mais tarde.')
    }

    const { subject: emailSubject, html } = supportContactTemplate({
      userEmail:   user.email,
      coupleNames: wedding?.couple_names ?? null,
      subject:     parsed.data.subject,
      message:     parsed.data.message,
    })

    await sendEmail({ to: supportInbox, subject: emailSubject, html, replyTo: user.email })

    return ok({ sent: true })
  } catch (error) {
    return handleApiError(error)
  }
}
