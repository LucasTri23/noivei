import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateVendorCouponSchema } from '@/lib/api/validation/admin-vendor-coupon.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const { data, error } = await supabase
      .from('vendor_coupons')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar cupons de fornecedor.')

    return ok(data ?? [])
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `admin-vendor-coupon-write:${user.id}`, 50, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const body = await parseJsonBody(req)
    const parsed = CreateVendorCouponSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('vendor_coupons')
      .insert(parsed.data as Record<string, unknown>)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return err(409, 'COUPON_CODE_TAKEN', 'Já existe um cupom de fornecedor com esse código.')
      }
      return err(500, 'DB_ERROR', 'Erro ao criar cupom de fornecedor.')
    }

    return ok(data, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
