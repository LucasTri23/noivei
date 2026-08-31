import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateVendorCategorySchema } from '@/lib/api/validation/admin-vendor-category.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

// GET aqui é admin-only e enxerga TODAS as categorias, inclusive inativas — o
// wizard de cadastro e a página de assinatura buscam categorias/planos ativos
// direto via Server Component (RLS "anyone can read active"), sem passar por rota
// de API nenhuma; esta é só pra tela de administração.
export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const { data, error } = await supabase
      .from('vendor_categories')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar categorias de fornecedor.')

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

    const limitCheck = await checkRateLimit(supabase, `admin-vendor-category-write:${user.id}`, 50, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const body = await parseJsonBody(req)
    const parsed = CreateVendorCategorySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('vendor_categories')
      .insert(parsed.data)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return err(409, 'CATEGORY_SLUG_TAKEN', 'Já existe uma categoria com esse identificador.')
      return err(500, 'DB_ERROR', 'Erro ao criar categoria de fornecedor.')
    }

    return ok(data, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
