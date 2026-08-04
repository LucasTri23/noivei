import { z } from 'zod'

import { AUTH_RATE_LIMITS } from '@/lib/auth/rate-limit-config'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

// resetPasswordForEmail() nunca cria sessão — mesma razão do signup, sem risco de
// sincronização de cookie ao mover pro servidor.
const ForgotPasswordBodySchema = z.object({
  email:        z.string().trim().toLowerCase().email('E-mail inválido').max(255),
  captchaToken: z.string().min(1, 'Confirme que você não é um robô.'),
  origin:       z.string().trim().url('Origem inválida'),
})

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req)
    const parsed = ForgotPasswordBodySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Revise os campos destacados e tente novamente.', parsed.error.flatten())
    }

    const { email, captchaToken, origin } = parsed.data
    const ip = getClientIp(req)
    const limits = AUTH_RATE_LIMITS.forgot_password

    const rateLimitSupabase = createSupabaseService()

    const ipResult = await checkRateLimit(rateLimitSupabase, `forgot_password:ip:${ip}`, limits.ip.max, limits.ip.windowSeconds)
    if (!ipResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')
    }

    const emailResult = await checkRateLimit(rateLimitSupabase, `forgot_password:id:${email}`, limits.identifier.max, limits.identifier.windowSeconds)
    if (!emailResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')
    }

    const supabase = await createSupabaseServer()
    // Resposta sempre "enviado", exista o e-mail ou não — evita confirmar/negar
    // cadastro (mesmo padrão de privacidade já usado nos outros fluxos de auth).
    // Erro real (rede, config) é só logado — nunca vira mensagem diferente pro
    // cliente, senão a diferença de resposta já vazaria a existência do e-mail.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?type=recovery`,
      captchaToken,
    })
    if (error) {
      console.error('[auth/forgot-password] falha ao enviar e-mail de recuperação:', error.message)
    }

    return ok({ sent: true })
  } catch (error) {
    return handleApiError(error)
  }
}
