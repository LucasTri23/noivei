import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { isPaidPlan, PLAN_NAMES, type PlanId } from '@/constants/plans'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { deriveWeddingColorScale } from '@/lib/theme/wedding-color'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'
import Sidebar from '@/components/layout/sidebar'
import MobileTopBar from '@/components/layout/mobile-top-bar'
import MobileBottomNav from '@/components/layout/mobile-bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const userWedding = await getUserWedding(supabase, user.id)

  // As duas consultas abaixo só dependem de userWedding.id, não uma da outra —
  // rodar em paralelo poupa um round-trip no caminho crítico que toda página
  // autenticada passa (este layout envolve todo o grupo (app)).
  const [{ data: wedding }, planId] = userWedding
    ? await Promise.all([
        supabase
          .from('weddings')
          .select('couple_names, wedding_color')
          .eq('id', userWedding.id)
          .maybeSingle(),
        resolveWeddingPlanId(supabase, userWedding.id),
      ])
    : [{ data: null }, 'free' as PlanId]

  const coupleNames = wedding?.couple_names ?? 'Meu Casamento'
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
      <Sidebar coupleNames={coupleNames} plan={planLabel} initial={initial} isFreePlan={!isPaidPlan(planId)} />

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
