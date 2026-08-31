import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpdateVendorCategorySchema } from '@/lib/api/validation/admin-vendor-category.schema'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Sem DELETE de propósito: vendor_category_links.category_id é ON DELETE RESTRICT
// (migration 20260806000002) — apagar uma categoria ainda vinculada a algum
// fornecedor deve falhar alto, não sumir em cascata. O caminho certo pra "remover"
// uma categoria é active=false, via PATCH.
export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `admin-vendor-category-write:${user.id}`, 50, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const { id } = await params
    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'CATEGORY_NOT_FOUND', 'Categoria de fornecedor não encontrada.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateVendorCategorySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('vendor_categories')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar categoria de fornecedor.')
    if (!data) return err(404, 'CATEGORY_NOT_FOUND', 'Categoria de fornecedor não encontrada.')

    return ok(data)
  } catch (error) {
    return handleApiError(error)
  }
}
