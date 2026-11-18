import AdminVendorCreateForm from '@/components/admin/admin-vendor-create-form'
import { requireAuth } from '@/lib/auth/require-auth'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { CategoryTreeInput } from '@/lib/vendor/category-tree'

export default async function AdminVendorCreatePage() {
  const { user } = await requireAuth()
  const supabase = await createSupabaseServer()
  await requireAdmin(supabase, user.id)
  // Admin enxerga inativas pela RLS — o filtro de active fica explícito aqui;
  // subcategoria de principal inativa é descartada pelo buildCategoryTree do picker.
  const { data, error } = await supabase
    .from('vendor_categories')
    .select('id, slug, label, parent_id, sort_order')
    .eq('active', true)
    .order('sort_order')
  if (error) throw new Error('Não foi possível carregar as categorias.')
  return <AdminVendorCreateForm categories={(data ?? []) as CategoryTreeInput[]} />
}
