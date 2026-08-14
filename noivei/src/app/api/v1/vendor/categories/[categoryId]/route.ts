import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ categoryId: string }>
}

// Remove o vínculo do próprio fornecedor com uma categoria (Passo 2 do wizard).
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const vendor = await requireVendorProfile(supabase, user.id)
    const { categoryId } = await params

    if (!UuidSchema.safeParse(categoryId).success) {
      return err(404, 'CATEGORY_LINK_NOT_FOUND', 'Vínculo de categoria não encontrado.')
    }

    const { data, error } = await supabase
      .from('vendor_category_links')
      .delete()
      .eq('vendor_id', vendor.id)
      .eq('category_id', categoryId)
      .select('category_id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover categoria.')
    if (!data) return err(404, 'CATEGORY_LINK_NOT_FOUND', 'Vínculo de categoria não encontrado.')

    return ok({ category_id: categoryId })
  } catch (error) {
    return handleApiError(error)
  }
}
