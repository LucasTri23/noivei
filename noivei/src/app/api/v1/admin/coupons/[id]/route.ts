import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpdateCouponSchema } from '@/lib/api/validation/admin-coupon.schema'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)
    const { id } = await params

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'COUPON_NOT_FOUND', 'Cupom não encontrado.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateCouponSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('coupons')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar cupom.')
    if (!data) return err(404, 'COUPON_NOT_FOUND', 'Cupom não encontrado.')

    return ok(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)
    const { id } = await params

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'COUPON_NOT_FOUND', 'Cupom não encontrado.')
    }

    const { data, error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover cupom.')
    if (!data) return err(404, 'COUPON_NOT_FOUND', 'Cupom não encontrado.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
