import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateCouponSchema } from '@/lib/api/validation/admin-coupon.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar cupons.')

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

    const body = await parseJsonBody(req)
    const parsed = CreateCouponSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('coupons')
      .insert(parsed.data)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return err(409, 'COUPON_CODE_TAKEN', 'Já existe um cupom com esse código.')
      }
      return err(500, 'DB_ERROR', 'Erro ao criar cupom.')
    }

    return ok(data, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
