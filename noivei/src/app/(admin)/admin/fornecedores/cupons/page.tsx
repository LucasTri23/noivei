import AdminVendorCouponsManager from '@/components/admin/admin-vendor-coupons-manager'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorCoupon, VendorPlan } from '@/types/database'

export const metadata = { title: 'Admin · Cupons de fornecedor' }

export default async function AdminFornecedoresCuponsPage() {
  const supabase = await createSupabaseServer()
  const [{ data: coupons }, { data: plans }] = await Promise.all([
    supabase.from('vendor_coupons').select('*').order('created_at', { ascending: false }),
    supabase.from('vendor_plans').select('id, name, billing_type').eq('active', true).order('sort_order'),
  ])

  return (
    <AdminVendorCouponsManager
      initialCoupons={(coupons ?? []) as VendorCoupon[]}
      plans={(plans ?? []) as Pick<VendorPlan, 'id' | 'name' | 'billing_type'>[]}
    />
  )
}
