import { z } from 'zod'

import { AUTH_RATE_LIMITS } from '@/lib/auth/rate-limit-config'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

// verifyOtp precisa acontecer nesta rota (não no browser) pelo mesmo motivo do
// login: o rate limit é checado no mesmo request que autentica de verdade, e
// createSupabaseServer() é o que grava a sessão como cookie na resposta desta
// rota — o client de browser nunca verifica sozinho neste fluxo.
//
// Sem captchaToken aqui de propósito: o campo equivalente na tipagem instalada do
// supabase-js (VerifyEmailOtpParams.options.captchaToken) está marcado @deprecated.
// A proteção contra força bruta do código vem só do rate limit abaixo — o próprio
// fluxo já exige posse do e-mail (só quem recebeu o código consegue chegar aqui).
const VerifyOtpBodySchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(255),
  token: z.string().trim().min(6, 'Código inválido').max(12),
})

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req)
    const parsed = VerifyOtpBodySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Revise os campos destacados e tente novamente.', parsed.error.flatten())
    }

    const { email, token } = parsed.data
    const ip = getClientIp(req)
    const limits = AUTH_RATE_LIMITS.verify_otp

    // Checagem de limite roda num client à parte (service role), mesmo padrão do
    // login/signup/forgot-password — não depende de sessão nenhuma.
    const rateLimitSupabase = createSupabaseService()

    const ipResult = await checkRateLimit(rateLimitSupabase, `verify_otp:ip:${ip}`, limits.ip.max, limits.ip.windowSeconds)
    if (!ipResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')
    }

    const emailResult = await checkRateLimit(rateLimitSupabase, `verify_otp:id:${email}`, limits.identifier.max, limits.identifier.windowSeconds)
    if (!emailResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')
    }

    // Client "de verdade": grava a sessão como cookie na resposta desta rota.
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })

    // Mensagem única pra código errado, expirado ou e-mail inexistente — nunca
    // diferencia o motivo (evita enumeração e não ajuda quem está tentando adivinhar
    // o código de outra pessoa), mesmo padrão de privacidade já usado no login.
    if (error || !data.session || !data.user) {
      return err(401, 'INVALID_OTP', 'Código inválido ou expirado. Solicite um novo código.')
    }

    return ok({ userId: data.user.id })
  } catch (error) {
    return handleApiError(error)
  }
}
