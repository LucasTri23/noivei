import AdminVendorCategoriesManager from '@/components/admin/admin-vendor-categories-manager'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorCategory } from '@/types/database'

export const metadata = { title: 'Admin · Categorias de fornecedor' }

export default async function AdminFornecedoresCategoriasPage() {
  const supabase = await createSupabaseServer()
  const { data } = await supabase.from('vendor_categories').select('*').order('sort_order')

  return <AdminVendorCategoriesManager initialCategories={(data ?? []) as VendorCategory[]} />
}
