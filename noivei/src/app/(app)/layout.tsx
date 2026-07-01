import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/sidebar'
import MobileTopBar from '@/components/layout/mobile-top-bar'
import MobileBottomNav from '@/components/layout/mobile-bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: wedding } = await supabase
    .from('weddings')
    .select('couple_names')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const coupleNames = wedding?.couple_names ?? 'Meu Casamento'
  const planId      = subscription?.plan_id ?? 'free'
  const planLabels: Record<string, string> = {
    free: 'Plano Gratuito',
    premium_monthly: 'Plano Premium',
    premium_once: 'Plano Premium',
    premium_plus_monthly: 'Plano Exclusivo',
    premium_plus_once: 'Plano Exclusivo',
  }
  const planLabel = planLabels[planId] ?? 'Plano Gratuito'
  const initial   = coupleNames.charAt(0).toUpperCase()

  return (
    <div
      className="flex min-h-screen"
      style={{ background: '#FAF5F0', fontFamily: 'var(--font-body)', color: '#3C2818' }}
    >
      <Sidebar coupleNames={coupleNames} plan={planLabel} initial={initial} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main
          className="flex-1"
          style={{
            padding: 'clamp(20px, 3.5vw, 44px)',
            paddingBottom: '112px',
            maxWidth: '1240px',
            width: '100%',
            margin: '0 auto',
          }}
        >
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  )
}
