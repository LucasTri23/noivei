import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const [
      { data: categories, error: categoriesError },
      { data: features, error: featuresError },
      { data: values, error: valuesError },
    ] = await Promise.all([
      supabase.from('plan_feature_categories').select('*').order('sort_order'),
      supabase.from('plan_features').select('*').order('sort_order'),
      supabase.from('plan_feature_values').select('*'),
    ])

    if (categoriesError || featuresError || valuesError) {
      return err(500, 'DB_ERROR', 'Erro ao buscar tabela de comparação de planos.')
    }

    return ok({ categories: categories ?? [], features: features ?? [], values: values ?? [] })
  } catch (error) {
    return handleApiError(error)
  }
}
