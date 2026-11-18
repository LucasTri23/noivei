import AdminVendorCategoriesManager, { type AdminVendorCategoryRow } from '@/components/admin/admin-vendor-categories-manager'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorCategory } from '@/types/database'

export const metadata = { title: 'Admin · Categorias de fornecedor' }

type CategoryWithCount = VendorCategory & { vendor_category_links: { count: number }[] | null }

export default async function AdminFornecedoresCategoriasPage() {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('vendor_categories')
    .select('*, vendor_category_links(count)')
    .order('sort_order')

  const rows: AdminVendorCategoryRow[] = ((data ?? []) as CategoryWithCount[]).map(({ vendor_category_links, ...category }) => ({
    ...category,
    vendor_count: vendor_category_links?.[0]?.count ?? 0,
  }))

  return <AdminVendorCategoriesManager initialCategories={rows} />
}
