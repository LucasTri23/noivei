import { z } from 'zod'

import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseService } from '@/lib/supabase/service'

// Pré-checagem chamada pelo front ANTES de signup/login/esqueci-senha, que vão
// direto pro Supabase Auth no browser (fora do nosso servidor) — essa rota é a
// única barreira nossa possível nesses fluxos. Limites fixos no servidor por
// `action`: o client nunca escolhe o limite, só qual ação está tentando.
const LIMITS: Record<string, { ip: { max: number; windowSeconds: number }; identifier: { max: number; windowSeconds: number } }> = {
  signup: {
    ip:         { max: 5, windowSeconds: 3600 },
    identifier: { max: 3, windowSeconds: 3600 },
  },
  login: {
    ip:         { max: 20, windowSeconds: 900 },
    identifier: { max: 8, windowSeconds: 900 },
  },
  forgot_password: {
    ip:         { max: 5, windowSeconds: 3600 },
    identifier: { max: 3, windowSeconds: 3600 },
  },
}

const BodySchema = z.object({
  action:     z.enum(['signup', 'login', 'forgot_password']),
  identifier: z.string().trim().min(1).max(255),
})

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req)
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const config = LIMITS[parsed.data.action]!
    const ip = getClientIp(req)
    const supabase = createSupabaseService()

    const ipResult = await checkRateLimit(supabase, `${parsed.data.action}:ip:${ip}`, config.ip.max, config.ip.windowSeconds)
    if (!ipResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.')
    }

    const identifierKey = parsed.data.identifier.toLowerCase()
    const identifierResult = await checkRateLimit(
      supabase,
      `${parsed.data.action}:id:${identifierKey}`,
      config.identifier.max,
      config.identifier.windowSeconds,
    )
    if (!identifierResult.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas para esse e-mail. Aguarde alguns minutos.')
    }

    return ok({ allowed: true })
  } catch (error) {
    return handleApiError(error)
  }
}
