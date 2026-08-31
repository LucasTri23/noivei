import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpdateVendorPlanSchema } from '@/lib/api/validation/admin-vendor-plan.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Alterar price_cents aqui NUNCA reescreve amount_cents de checkouts já feitos —
// vendor_payment_checkouts.amount_cents é capturado no momento do checkout (ver
// vendor/billing/checkout/route.ts), não recalculado a partir de vendor_plans. Uma
// mudança de preço só vale pra cima pra frente, histórico fica intacto por desenho.
export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `admin-vendor-plan-write:${user.id}`, 50, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const { id } = await params

    const body = await parseJsonBody(req)
    const parsed = UpdateVendorPlanSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('vendor_plans')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar plano de fornecedor.')
    if (!data) return err(404, 'PLAN_NOT_FOUND', 'Plano de fornecedor não encontrado.')

    return ok(data)
  } catch (error) {
    return handleApiError(error)
  }
}
