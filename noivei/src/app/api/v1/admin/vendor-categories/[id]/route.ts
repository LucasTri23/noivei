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

async function authorize() {
  const { user } = await requireAuth()
  const supabase = await createSupabaseServer()
  await requireAdmin(supabase, user.id)
  const limitCheck = await checkRateLimit(supabase, `admin-vendor-category-write:${user.id}`, 50, 3600)
  return { supabase, allowed: limitCheck.allowed }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { supabase, allowed } = await authorize()
    if (!allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const { id } = await params
    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'CATEGORY_NOT_FOUND', 'Categoria de fornecedor não encontrada.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateVendorCategorySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }
    if (parsed.data.parent_id === id) {
      return err(400, 'INVALID_PARENT', 'Uma categoria não pode ser principal de si mesma.')
    }

    const { data, error } = await supabase
      .from('vendor_categories')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      // 23514 = triggers de hierarquia (máx. 2 níveis; subcategoria com
      // fornecedores não vira principal); 23503 = principal inexistente.
      if (error.code === '23514' || error.code === '23503') {
        return err(409, 'INVALID_HIERARCHY', 'Essa mudança quebraria a organização das categorias (máximo de 2 níveis e subcategorias com fornecedores não podem virar principais).')
      }
      return err(500, 'DB_ERROR', 'Erro ao atualizar categoria de fornecedor.')
    }
    if (!data) return err(404, 'CATEGORY_NOT_FOUND', 'Categoria de fornecedor não encontrada.')

    return ok(data)
  } catch (error) {
    return handleApiError(error)
  }
}

// Exclusão só de categoria sem nenhum vínculo e sem subcategorias — com uso, o
// caminho é desativar (PATCH active=false). O ON DELETE RESTRICT de
// vendor_category_links/parent_id continua como última barreira no banco.
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { supabase, allowed } = await authorize()
    if (!allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const { id } = await params
    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'CATEGORY_NOT_FOUND', 'Categoria de fornecedor não encontrada.')
    }

    const [{ count: linkCount, error: linkError }, { count: childCount, error: childError }] = await Promise.all([
      supabase.from('vendor_category_links').select('vendor_id', { count: 'exact', head: true }).eq('category_id', id),
      supabase.from('vendor_categories').select('id', { count: 'exact', head: true }).eq('parent_id', id),
    ])
    if (linkError || childError) return err(500, 'DB_ERROR', 'Erro ao verificar uso da categoria.')

    if (linkCount) {
      return err(409, 'CATEGORY_IN_USE', `Esta categoria tem ${linkCount} fornecedor(es) vinculado(s). Desative-a em vez de excluir.`)
    }
    if (childCount) {
      return err(409, 'CATEGORY_HAS_CHILDREN', 'Esta categoria tem subcategorias. Mova ou exclua as subcategorias antes.')
    }

    const { data, error } = await supabase
      .from('vendor_categories')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      if (error.code === '23503') return err(409, 'CATEGORY_IN_USE', 'Esta categoria está em uso. Desative-a em vez de excluir.')
      return err(500, 'DB_ERROR', 'Erro ao excluir categoria de fornecedor.')
    }
    if (!data) return err(404, 'CATEGORY_NOT_FOUND', 'Categoria de fornecedor não encontrada.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
