import AdminVendorCreateForm from '@/components/admin/admin-vendor-create-form'
import { requireAuth } from '@/lib/auth/require-auth'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createSupabaseServer } from '@/lib/supabase/server'

export default async function AdminVendorCreatePage() {
  const { user } = await requireAuth()
  const supabase = await createSupabaseServer()
  await requireAdmin(supabase, user.id)
  const { data, error } = await supabase.from('vendor_categories').select('id, label').eq('active', true).order('sort_order')
  if (error) throw new Error('Não foi possível carregar as categorias.')
  return <AdminVendorCreateForm categories={(data ?? []) as { id: string; label: string }[]} />
}
