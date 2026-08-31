import AdminVendorPlansManager from '@/components/admin/admin-vendor-plans-manager'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorPlan } from '@/types/database'

export const metadata = { title: 'Admin · Planos de fornecedor' }

export default async function AdminFornecedoresPlanosPage() {
  const supabase = await createSupabaseServer()
  const { data } = await supabase.from('vendor_plans').select('*').order('sort_order')

  return <AdminVendorPlansManager initialPlans={(data ?? []) as VendorPlan[]} />
}
