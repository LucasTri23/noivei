import { z } from 'zod'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

const RedeemCouponSchema = z.object({
  code: z.string().trim().min(1).max(40),
})

interface RedeemCouponResult {
  discount_type:      string
  discount_value:     number | null
  applies_to_plan_id: string | null
  benefit_days:       number | null
}

// Todo o resgate acontece dentro de fn_redeem_coupon() (SECURITY DEFINER, ver
// migration 20260723000002) — essa rota só chama a function via RPC com o client
// autenticado normal, sem precisar de service role: a function já valida tudo
// (ativo, validade, limite de usos, resgate único por usuário) e grava atomicamente.
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()

    const body = await parseJsonBody(req)
    const parsed = RedeemCouponSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Informe um código de cupom.', parsed.error.flatten())
    }

    // Tentativa de adivinhar código de cupom por força bruta — limita por usuário
    // e por IP (o mesmo atacante trocando de conta ainda esbarra no IP).
    const userLimit = await checkRateLimit(supabase, `coupon:user:${user.id}`, 10, 3600)
    if (!userLimit.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    const ipLimit = await checkRateLimit(supabase, `coupon:ip:${getClientIp(req)}`, 20, 3600)
    if (!ipLimit.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    // Database = any (ver types/database.ts) faz o retorno do rpc() cair em `{}` —
    // o cast reflete o que fn_redeem_coupon() de fato retorna (ver migration).
    const { data, error } = (await supabase
      .rpc('fn_redeem_coupon', { p_code: parsed.data.code, p_user_id: user.id })
      .maybeSingle()) as { data: RedeemCouponResult | null; error: { message: string } | null }

    if (error) {
      if (error.message.includes('coupon_not_found')) {
        return err(404, 'COUPON_NOT_FOUND', 'Cupom não encontrado, inativo ou expirado.')
      }
      if (error.message.includes('already_redeemed')) {
        return err(409, 'ALREADY_REDEEMED', 'Você já usou este cupom.')
      }
      return err(500, 'DB_ERROR', 'Erro ao aplicar o cupom.')
    }

    if (!data) return err(404, 'COUPON_NOT_FOUND', 'Cupom não encontrado, inativo ou expirado.')

    const message =
      data.discount_type === 'free_days'
        ? `Cupom aplicado! Acesso liberado por ${data.benefit_days} dia(s).`
        : 'Cupom válido! O desconto será aplicado quando o pagamento for processado.'

    return ok({ message })
  } catch (error) {
    return handleApiError(error)
  }
}
