import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { AddVendorCategorySchema } from '@/lib/api/validation/vendor.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

// Vincula uma categoria ativa ao próprio perfil de fornecedor (Passo 2 do wizard de
// cadastro). Idempotente: repetir a mesma categoria não é erro.
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const vendor = await requireVendorProfile(supabase, user.id)

    const body = await parseJsonBody(req)
    const parsed = AddVendorCategorySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data: category, error: categoryError } = await supabase
      .from('vendor_categories')
      .select('id')
      .eq('id', parsed.data.category_id)
      .eq('active', true)
      .maybeSingle()

    if (categoryError) return err(500, 'DB_ERROR', 'Erro ao verificar categoria.')
    if (!category) return err(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada ou inativa.')

    const { error } = await supabase
      .from('vendor_category_links')
      .insert({ vendor_id: vendor.id, category_id: parsed.data.category_id })

    if (error && error.code !== '23505') {
      return err(500, 'DB_ERROR', 'Erro ao vincular categoria.')
    }

    return ok({ vendor_id: vendor.id, category_id: parsed.data.category_id }, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
