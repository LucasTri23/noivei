import { redirect } from 'next/navigation'
import VendorSubscriptionManager from '@/components/vendors/dashboard/vendor-subscription-manager'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorPlan, VendorSubscription } from '@/types/database'

// Fase 6 (painel completo do fornecedor) + Fase 5 (billing completo): tela de
// assinatura do fornecedor — antes desta página não existia NENHUMA forma de
// contratar/cancelar o plano pago pelo produto (só existia o schema de banco).
export const metadata = { robots: { index: false, follow: false } }

export default async function VendorAssinaturaPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!vendor) redirect('/fornecedor/cadastro')
  if (!['active', 'paused'].includes(vendor.status)) redirect('/fornecedor')

  const [{ data: plans }, { data: subscription }] = await Promise.all([
    supabase.from('vendor_plans').select('*').eq('active', true).order('sort_order'),
    supabase
      .from('vendor_subscriptions')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <div>
      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(24px,3.2vw,30px)', margin: '0 0 22px', color: 'var(--fg)' }}>
        Assinatura
      </h1>

      <VendorSubscriptionManager
        plans={(plans ?? []) as VendorPlan[]}
        subscription={(subscription ?? null) as VendorSubscription | null}
      />
    </div>
  )
}
