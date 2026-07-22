import AdminCouponsManager from '@/components/admin/admin-coupons-manager'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { Coupon } from '@/types/database'

export const metadata = { title: 'Admin · Cupons' }

export default async function AdminCuponsPage() {
  const supabase = await createSupabaseServer()

  const { data: coupons } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  return <AdminCouponsManager initialCoupons={(coupons ?? []) as Coupon[]} />
}
