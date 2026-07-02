import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { PlanId } from '@/constants/plans'
import PlanSelector from '@/components/perfil/plan-selector'

export const metadata = { title: 'Planos' }

export default async function PlanosPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, plan_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const currentPlanId = (subscription?.plan_id ?? 'free') as PlanId

  return (
    <div>
      <Link href="/perfil" style={{ fontSize: '13.5px', color: '#9A7A60', textDecoration: 'none' }}>
        ← Voltar ao perfil
      </Link>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: '#3C2818', margin: '10px 0 6px' }}
      >
        Planos
      </h1>
      <p style={{ fontSize: '14.5px', color: '#9A7A60', margin: '0 0 28px' }}>
        Compare os planos e escolha o ideal para o casamento de vocês. Você pode mudar quando quiser.
      </p>

      <PlanSelector
        userId={user.id}
        currentPlanId={currentPlanId}
        subscriptionId={subscription?.id ?? null}
      />
    </div>
  )
}
