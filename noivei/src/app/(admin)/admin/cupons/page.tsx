import AdminCouponsManager from '@/components/admin/admin-coupons-manager'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { Coupon } from '@/types/database'

export const metadata = { title: 'Admin · Cupons' }

export default async function AdminCuponsPage() {
  const supabase = await createSupabaseServer()

  const [{ data: coupons }, { data: plansData }] = await Promise.all([
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    // Cupom de dias grátis concede um plano PAGO — planos com price_brl = 0 (Gratuito)
    // não fazem sentido aqui, por isso o filtro. billing_label ("Mensal"/"Pagamento
    // único") vai junto pra distinguir as variantes do mesmo plano na hora de escolher
    // — sem isso, "Premium" aparecia duas vezes na lista sem dar pra saber qual era qual.
    supabase.from('plans').select('id, name, billing_label').eq('is_active', true).gt('price_brl', 0).order('sort_order'),
  ])

  return (
    <AdminCouponsManager
      initialCoupons={(coupons ?? []) as Coupon[]}
      plans={(plansData ?? []) as { id: string; name: string; billing_label: string | null }[]}
    />
  )
}
