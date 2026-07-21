import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase/server'
import { isPaidPlan, isPlusPlan, type PlanId } from '@/constants/plans'

export type PaywallFeature = 'mesas' | 'site' | 'presentes'

interface FeatureInfo {
  name:         string
  description:  string
  requiredPlan: 'premium' | 'premium_plus'
}

const FEATURES: Record<PaywallFeature, FeatureInfo> = {
  mesas: {
    name:         'Organização de mesas',
    description:  'Monte o mapa de mesas da festa arrastando convidados, controle a capacidade de cada mesa e garanta que ninguém fique sem lugar.',
    requiredPlan: 'premium',
  },
  site: {
    name:         'Site do casal',
    description:  'Crie um site lindo para o seu casamento com história, cerimônia, lista de presentes, galeria e confirmação de presença online.',
    requiredPlan: 'premium',
  },
  presentes: {
    name:         'Lista de presentes',
    description:  'Monte a lista de presentes do casamento, organize preço e loja de cada item e marque manualmente o que já foi dado por convidados.',
    requiredPlan: 'premium',
  },
}

interface PaywallGateProps {
  feature:  PaywallFeature
  children: React.ReactNode
}

function LockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

/**
 * Bloqueia `children` para quem não tem o plano exigido pelo recurso.
 * Busca a assinatura ativa do usuário (mesmo padrão do layout de (app));
 * sem assinatura ativa, assume o plano Gratuito.
 */
export default async function PaywallGate({ feature, children }: PaywallGateProps) {
  const { name, description, requiredPlan } = FEATURES[feature]

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  let planId: PlanId = 'free'
  if (user) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    planId = (subscription?.plan_id ?? 'free') as PlanId
  }

  const allowed = requiredPlan === 'premium_plus' ? isPlusPlan(planId) : isPaidPlan(planId)

  if (allowed) return <>{children}</>

  const requiredPlanName = requiredPlan === 'premium_plus' ? 'Premium Plus' : 'Premium'

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <div
        className="relative w-full overflow-hidden rounded-2xl p-8 text-center sm:p-10"
        style={{
          maxWidth: '520px',
          background: 'linear-gradient(150deg, #2A1E10, #3A2A18)',
          color: '#FAF0E6',
          boxShadow: '0 16px 40px rgba(60,40,24,0.18)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 16%, transparent) 1.3px, transparent 1.5px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div style={{ position: 'relative' }}>
          <div
            className="mx-auto flex items-center justify-center"
            style={{
              width: '58px', height: '58px', borderRadius: '18px', marginBottom: '18px',
              background: 'color-mix(in srgb, var(--wedding-color) 22%, transparent)',
              color: 'var(--wedding-color-light)',
            }}
          >
            <LockIcon />
          </div>

          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '99px',
              background: 'color-mix(in srgb, var(--wedding-color) 22%, transparent)',
              color: 'var(--wedding-color-light)',
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: '14px',
            }}
          >
            <StarIcon /> Recurso {requiredPlanName}
          </div>

          <h2
            className="font-display"
            style={{ fontSize: 'clamp(24px,3.4vw,30px)', fontWeight: 500, color: '#FAF0E6', lineHeight: 1.15, marginBottom: '10px' }}
          >
            {name}
          </h2>

          <p style={{ fontSize: '14px', color: 'rgba(250,240,230,0.65)', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: '400px' }}>
            {description} Disponível a partir do plano {requiredPlanName}.
          </p>

          <Link
            href="/perfil/planos"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'var(--wedding-color-light)', color: '#2A1E10', border: 'none',
              borderRadius: '12px', padding: '13px 24px',
              fontWeight: 700, fontSize: '14px', textDecoration: 'none',
            }}
          >
            Ver planos e fazer upgrade
          </Link>
        </div>
      </div>
    </div>
  )
}
