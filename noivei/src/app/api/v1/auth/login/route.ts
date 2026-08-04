import { z } from 'zod'

import { AUTH_RATE_LIMITS } from '@/lib/auth/rate-limit-config'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

// Login precisa acontecer NESTA rota (não no browser) pra que o rate limit seja
// verificado no mesmo request que autentica de verdade — antes, a checagem era uma
// chamada opcional que o cliente podia simplesmente não fazer, indo direto ao
// endpoint do Supabase Auth (URL/anon key são públicas por design). Chamar
// `signInWithPassword` aqui, via `createSupabaseServer()`, também é o que faz a
// sessão ser gravada como cookie na resposta desta rota — o client de browser nunca
// autentica sozinho neste fluxo.
const LoginBodySchema = z.object({
  email:        z.string().trim().toLowerCase().email('E-mail inválido').max(255),
  password:     z.string().min(1, 'Senha obrigatória').max(200),
  captchaToken: z.string().min(1, 'Confirme que você não é um robô.'),
})

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req)
    const parsed = LoginBodySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Revise os campos destacados e tente novamente.', parsed.error.flatten())
    }

    const { email, password, captchaToken } = parsed.data
    const ip = getClientIp(req)
    const limits = AUTH_RATE_LIMITS.login

    // Checagem de limite roda num client à parte (service role, mesmo padrão da
    // antiga check-rate-limit) — não depende de sessão nenhuma, só grava o hit numa
    // tabela própria via função SECURITY DEFINER.
    const rateLimitSupabase = createSupabaseService()

    const ipResult = await checkRateLimit(rateLimitSupabase, `login:ip:${ip}`, limits.ip.max, limits.ip.windowSeconds)
    if (!ipResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')
    }

    const emailResult = await checkRateLimit(rateLimitSupabase, `login:id:${email}`, limits.identifier.max, limits.identifier.windowSeconds)
    if (!emailResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')
    }

    // Client "de verdade": grava a sessão como cookie na resposta desta rota.
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    })

    // Mensagem única pra credenciais erradas OU e-mail inexistente — não confirma
    // nem nega se o e-mail tem conta (evita enumeração), mesmo padrão já usado no
    // cadastro deste projeto.
    if (error || !data.session || !data.user) {
      return err(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    }

    return ok({ userId: data.user.id })
  } catch (error) {
    return handleApiError(error)
  }
}
