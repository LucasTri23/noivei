import { z } from 'zod'

import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

const RedeemVendorCouponSchema = z.object({
  code: z.string().trim().min(1).max(40),
})

interface RedeemVendorCouponResult {
  discount_type:      string
  discount_value:     number | null
  applies_to_plan_id: string | null
  benefit_days:       number | null
}

// Espelha POST /api/v1/coupons/redeem (casal) pro lado do fornecedor — todo o
// resgate acontece dentro de fn_redeem_vendor_coupon() (SECURITY DEFINER, migration
// 20260806000003), esta rota só chama a function via RPC com o client autenticado
// normal.
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const vendor = await requireVendorProfile(supabase, user.id)
    if (!['active', 'paused'].includes(vendor.status)) {
      return err(403, 'VENDOR_APPROVAL_REQUIRED', 'Aguarde a aprovação do administrador para contratar um plano ou usar cupons.')
    }

    // Tentativa de adivinhar código de cupom por força bruta — limita por
    // fornecedor e por IP (mesmo raciocínio de /api/v1/coupons/redeem).
    const vendorLimit = await checkRateLimit(supabase, `vendor-coupon:vendor:${vendor.id}`, 10, 3600)
    if (!vendorLimit.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    const ipLimit = await checkRateLimit(supabase, `vendor-coupon:ip:${getClientIp(req)}`, 20, 3600)
    if (!ipLimit.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const body = await parseJsonBody(req)
    const parsed = RedeemVendorCouponSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Informe um código de cupom.', parsed.error.flatten())
    }

    const { data, error } = (await supabase
      .rpc('fn_redeem_vendor_coupon', { p_code: parsed.data.code, p_vendor_id: vendor.id })
      .maybeSingle()) as { data: RedeemVendorCouponResult | null; error: { message: string } | null }

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

    return ok({
      message,
      discount_type:      data.discount_type,
      discount_value:     data.discount_value,
      applies_to_plan_id: data.applies_to_plan_id,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
