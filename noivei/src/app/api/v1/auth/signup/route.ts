import { z } from 'zod'

import { AUTH_RATE_LIMITS } from '@/lib/auth/rate-limit-config'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

// signUp() nunca cria sessão de acesso direto (o Supabase exige confirmação de
// e-mail antes) — diferente do login, não há cookie de sessão a sincronizar aqui,
// então mover pro servidor é estritamente mais simples/seguro, sem esse risco.
const SignupBodySchema = z.object({
  fullName:     z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(120),
  email:        z.string().trim().toLowerCase().email('E-mail inválido').max(255),
  password:     z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').max(200),
  terms:        z.literal(true, { error: 'Você deve aceitar os termos' }),
  captchaToken: z.string().min(1, 'Confirme que você não é um robô.'),
  origin:       z.string().trim().url('Origem inválida'),
})

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req)
    const parsed = SignupBodySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Revise os campos destacados e tente novamente.', parsed.error.flatten())
    }

    const { fullName, email, password, captchaToken, origin } = parsed.data
    const ip = getClientIp(req)
    const limits = AUTH_RATE_LIMITS.signup

    const rateLimitSupabase = createSupabaseService()

    const ipResult = await checkRateLimit(rateLimitSupabase, `signup:ip:${ip}`, limits.ip.max, limits.ip.windowSeconds)
    if (!ipResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')
    }

    const emailResult = await checkRateLimit(rateLimitSupabase, `signup:id:${email}`, limits.identifier.max, limits.identifier.windowSeconds)
    if (!emailResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')
    }

    const supabase = await createSupabaseServer()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data:            { full_name: fullName },
        emailRedirectTo: `${origin}/auth/callback`,
        captchaToken,
      },
    })

    // Nunca repassar error.message cru: "User already registered" confirmaria pra
    // quem está atacando se um e-mail já tem conta (enumeração) — mesma mensagem
    // genérica de sempre, sem confirmar nem negar.
    if (error) {
      return err(400, 'SIGNUP_FAILED', 'Não foi possível criar a conta. Se você já tem cadastro, tente entrar.')
    }

    return ok({ email })
  } catch (error) {
    return handleApiError(error)
  }
}
