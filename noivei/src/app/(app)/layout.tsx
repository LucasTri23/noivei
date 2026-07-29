import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { isPaidPlan, PLAN_NAMES } from '@/constants/plans'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { deriveWeddingColorScale, deriveBrandDarkGradient } from '@/lib/theme/wedding-color'
import { getUserWedding, hasModuleAccess } from '@/lib/weddings/get-user-wedding'
import Sidebar from '@/components/layout/sidebar'
import MobileTopBar from '@/components/layout/mobile-top-bar'
import MobileBottomNav from '@/components/layout/mobile-bottom-nav'
import type { WeddingModuleKey } from '@/types/database'

const MODULE_KEYS: WeddingModuleKey[] = [
  'checklist', 'convidados', 'financeiro', 'mesas', 'site', 'arquivos', 'presentes', 'padrinhos',
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const userWedding = await getUserWedding(supabase, user.id)

  // Sem casamento nenhum (onboarding nunca concluído — por exemplo, se a sessão foi
  // estabelecida por um caminho que não passou pelo redirecionamento próprio de
  // /auth/callback, como login direto por e-mail/senha) — manda pro onboarding em vez
  // de deixar a pessoa presa no app com todo módulo aparecendo "acesso restrito".
  if (!userWedding) redirect('/onboarding')

  // As três consultas abaixo não dependem uma da outra — rodar em paralelo poupa
  // round-trips no caminho crítico que toda página autenticada passa (este layout
  // envolve todo o grupo (app)). plan_module_access inteira é pequena (poucas
  // dezenas de linhas, um plano ativo típico × 8 módulos) — mais barato trazer
  // tudo aqui e filtrar em código do que esperar planId resolver pra fazer uma
  // 2ª consulta em série.
  const [{ data: wedding }, planId, { data: planModuleRows }] = await Promise.all([
    supabase
      .from('weddings')
      .select('couple_names, wedding_color, wedding_color_secondary')
      .eq('id', userWedding.id)
      .maybeSingle(),
    resolveWeddingPlanId(supabase, userWedding.id),
    supabase.from('plan_module_access').select('plan_id, module, enabled'),
  ])

  const visibleModules = Object.fromEntries(
    MODULE_KEYS.map((module) => [module, hasModuleAccess(userWedding, module)]),
  ) as Record<WeddingModuleKey, boolean>

  // Quais módulos o PLANO atual libera (configurável em /admin/planos/modulos) —
  // decide o badge "PRO" no menu. Diferente de visibleModules acima (permissão de
  // MEMBRO convidado, sempre calculada em código) — linha ausente aqui é liberado
  // (fail-open), mesmo critério do PaywallGate.
  const planModuleAccessMap = new Map(
    (planModuleRows ?? [])
      .filter((row) => row.plan_id === planId)
      .map((row) => [row.module as WeddingModuleKey, row.enabled as boolean]),
  )
  const planModuleAccess = Object.fromEntries(
    MODULE_KEYS.map((module) => [module, planModuleAccessMap.get(module) ?? true]),
  ) as Record<WeddingModuleKey, boolean>

  const coupleNames = wedding?.couple_names ?? 'Meu Casamento'
  const planLabel   = `Plano ${PLAN_NAMES[planId] ?? 'Gratuito'}`
  const initial     = coupleNames.charAt(0).toUpperCase()

  // Cor do casamento sobrescreve o dourado padrão apenas nos planos pagos
  const colorScale =
    isPaidPlan(planId) && wedding?.wedding_color
      ? deriveWeddingColorScale(wedding.wedding_color)
      : null
  const colorScaleSecondary =
    isPaidPlan(planId) && wedding?.wedding_color_secondary
      ? deriveWeddingColorScale(wedding.wedding_color_secondary)
      : null

  const weddingColorVars = colorScale
    ? ({
        '--wedding-color':        colorScale.color,
        '--wedding-color-light':  colorScale.light,
        '--wedding-color-dark':   colorScale.dark,
        '--wedding-color-subtle': colorScale.subtle,
      } as React.CSSProperties)
    : undefined

  const weddingColorSecondaryVars = colorScaleSecondary
    ? ({
        '--wedding-color-secondary':        colorScaleSecondary.color,
        '--wedding-color-secondary-light':  colorScaleSecondary.light,
        '--wedding-color-secondary-dark':   colorScaleSecondary.dark,
        '--wedding-color-secondary-subtle': colorScaleSecondary.subtle,
      } as React.CSSProperties)
    : undefined

  // Painéis sempre-escuros (sidebar, cards de destaque, gates) usam o marrom fixo
  // por padrão — só planos pagos trocam pela cor secundária do casal, nunca o Gratuito.
  const brandDarkGradient =
    isPaidPlan(planId) && wedding?.wedding_color_secondary
      ? deriveBrandDarkGradient(wedding.wedding_color_secondary)
      : null

  const brandDarkGradientVars = brandDarkGradient
    ? ({
        '--brand-dark-gradient-from': brandDarkGradient.from,
        '--brand-dark-gradient-to':   brandDarkGradient.to,
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
        ...weddingColorSecondaryVars,
        ...brandDarkGradientVars,
      }}
    >
      <Sidebar
        coupleNames={coupleNames}
        plan={planLabel}
        initial={initial}
        visibleModules={visibleModules}
        planModuleAccess={planModuleAccess}
      />

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
        <MobileBottomNav visibleModules={visibleModules} planModuleAccess={planModuleAccess} />
      </div>
    </div>
  )
}
