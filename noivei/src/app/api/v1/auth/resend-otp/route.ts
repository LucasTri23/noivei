import { z } from 'zod'

import { AUTH_RATE_LIMITS } from '@/lib/auth/rate-limit-config'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

// resend() nunca cria sessão — mesma razão do signup/forgot-password, sem cookie
// a sincronizar aqui. createSupabaseServer() é usado (não o client de service
// role) pelo mesmo motivo do forgot-password: é o fluxo público padrão do
// supabase-js, o único que sabe validar o captchaToken via Turnstile/GoTrue.
//
// captchaToken é obrigatório aqui — diferente de verify-otp, essa é a ação mais
// abusável do fluxo: dispara e-mail de verdade pra qualquer endereço informado,
// sem provar posse alguma antes do envio (spam pra terceiro).
const ResendOtpBodySchema = z.object({
  email:        z.string().trim().toLowerCase().email('E-mail inválido').max(255),
  captchaToken: z.string().min(1, 'Confirme que você não é um robô.'),
})

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req)
    const parsed = ResendOtpBodySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Revise os campos destacados e tente novamente.', parsed.error.flatten())
    }

    const { email, captchaToken } = parsed.data
    const ip = getClientIp(req)
    const limits = AUTH_RATE_LIMITS.resend_otp

    const rateLimitSupabase = createSupabaseService()

    const ipResult = await checkRateLimit(rateLimitSupabase, `resend_otp:ip:${ip}`, limits.ip.max, limits.ip.windowSeconds)
    if (!ipResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Aguarde alguns minutos antes de solicitar um novo envio.')
    }

    const emailResult = await checkRateLimit(rateLimitSupabase, `resend_otp:id:${email}`, limits.identifier.max, limits.identifier.windowSeconds)
    if (!emailResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Aguarde alguns minutos antes de solicitar um novo envio.')
    }

    // Cooldown curto numa chave própria — não consome as poucas tentativas do
    // limite por e-mail acima, só barra cliques repetidos em sequência.
    const cooldown = limits.cooldown
    const cooldownResult = await checkRateLimit(rateLimitSupabase, `resend_otp_cooldown:id:${email}`, cooldown.max, cooldown.windowSeconds)
    if (!cooldownResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Aguarde alguns minutos antes de solicitar um novo envio.')
    }

    const supabase = await createSupabaseServer()
    // Resposta sempre "enviado" — mesmo padrão de privacidade do forgot-password,
    // nunca confirma nem nega se o e-mail existe ou já foi confirmado. Erro real
    // (rede, config, e-mail já confirmado) é só logado, nunca vira mensagem
    // diferente pro cliente, senão a diferença de resposta já vazaria a informação.
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { captchaToken },
    })
    if (error) {
      console.error('[auth/resend-otp] falha ao reenviar código:', error.message)
    }

    return ok({ sent: true })
  } catch (error) {
    return handleApiError(error)
  }
}
