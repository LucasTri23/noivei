import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { isPaidPlan, PLAN_NAMES, type PlanId } from '@/constants/plans'
import { deriveWeddingColorScale } from '@/lib/theme/wedding-color'
import Sidebar from '@/components/layout/sidebar'
import MobileTopBar from '@/components/layout/mobile-top-bar'
import MobileBottomNav from '@/components/layout/mobile-bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: wedding } = await supabase
    .from('weddings')
    .select('couple_names, wedding_color')
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
  const planId      = (subscription?.plan_id ?? 'free') as PlanId
  const planLabel   = `Plano ${PLAN_NAMES[planId] ?? 'Gratuito'}`
  const initial     = coupleNames.charAt(0).toUpperCase()

  // Cor do casamento sobrescreve o dourado padrão apenas nos planos pagos
  const colorScale =
    isPaidPlan(planId) && wedding?.wedding_color
      ? deriveWeddingColorScale(wedding.wedding_color)
      : null

  const weddingColorVars = colorScale
    ? ({
        '--wedding-color':        colorScale.color,
        '--wedding-color-light':  colorScale.light,
        '--wedding-color-dark':   colorScale.dark,
        '--wedding-color-subtle': colorScale.subtle,
      } as React.CSSProperties)
    : undefined

  return (
    <div
      className="flex min-h-screen"
      style={{
        background: 'var(--bg)',
        fontFamily: 'var(--font-body)',
        color: 'var(--fg)',
        ...weddingColorVars,
      }}
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
