import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { ReorderVendorCategoriesSchema } from '@/lib/api/validation/admin-vendor-category.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

// Recebe os ids de categorias irmãs na ordem final; a RPC grava sort_order de
// todas numa única transação (sem estado intermediário com ordens repetidas).
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `admin-vendor-category-write:${user.id}`, 50, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const body = await parseJsonBody(req)
    const parsed = ReorderVendorCategoriesSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { error } = await supabase.rpc('fn_admin_reorder_vendor_categories', { p_ids: parsed.data.ids })
    if (error) {
      if (error.code === '22023') return err(400, 'VALIDATION_ERROR', 'Só é possível reordenar categorias do mesmo nível.')
      return err(500, 'DB_ERROR', 'Erro ao reordenar categorias.')
    }

    return ok({ ids: parsed.data.ids })
  } catch (error) {
    return handleApiError(error)
  }
}
