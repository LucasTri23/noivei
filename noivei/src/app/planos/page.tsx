import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase/server'
import PublicPlanCards from '@/components/marketing/public-plan-cards'
import PlanBenefitsSection from '@/components/marketing/plan-benefits-section'
import PlanComparisonRich from '@/components/marketing/plan-comparison-rich'
import PlanFaqSection from '@/components/marketing/plan-faq-section'
import ScrollRevealInit from '@/components/marketing/scroll-reveal-init'
import type { PlanFeature, PlanFeatureCategory, PlanFeatureValue } from '@/types/database'

export const metadata = {
  title: 'Planos',
  description:
    'Conheça os planos do Wednest e escolha o ideal para organizar cada detalhe do seu casamento — do checklist ao grande dia.',
}

/**
 * Vitrine pública de planos (`/planos`) — sem exigir login, pra visitantes
 * decidirem antes de criar conta. Catálogo sempre vem do banco (mesmo padrão
 * de busca de /perfil/planos), então um plano novo/editado em /admin/planos
 * aparece aqui sem deploy.
 */
export default async function PlanosPublicPage() {
  const supabase = await createSupabaseServer()

  const [{ data: plansData }, { data: categories }, { data: features }, { data: values }] = await Promise.all([
    supabase
      .from('plans')
      .select('id, name, description, price_brl, group_key, billing_label, billing_note, emoji, highlight, billing_interval')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('plan_feature_categories').select('*').order('sort_order'),
    supabase.from('plan_features').select('*').order('sort_order'),
    supabase.from('plan_feature_values').select('*'),
  ])

  const plans = plansData ?? []
  const planCategories = (categories ?? []) as PlanFeatureCategory[]
  const planFeatures = (features ?? []) as PlanFeature[]
  const planValues = (values ?? []) as PlanFeatureValue[]

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <ScrollRevealInit />

      {/* Cabeçalho — mesmo estilo da landing */}
      <header
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: '1240px', padding: 'clamp(18px, 3vw, 32px) clamp(20px, 4vw, 44px)' }}
      >
        <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}>
          <WednestMark />
          <span
            className="font-display"
            style={{ fontSize: '22px', fontWeight: 500, color: 'var(--wedding-color-dark)', letterSpacing: '0.02em' }}
          >
            Wednest
          </span>
        </Link>
        <Link href="/login" className="text-sm font-semibold" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
          Entrar
        </Link>
      </header>

      {/* Hero */}
      <section
        className="mx-auto flex flex-col items-center text-center"
        style={{ maxWidth: '820px', padding: 'clamp(24px, 4vw, 48px) clamp(20px, 4vw, 44px) clamp(48px, 6vw, 80px)' }}
      >
        <span
          className="rounded-full"
          style={{
            fontSize: '12.5px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--wedding-color-dark)',
            background: 'var(--wedding-color-subtle)',
            padding: '6px 14px',
            marginBottom: '22px',
          }}
        >
          Planos
        </span>

        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.1, color: 'var(--fg)', margin: 0 }}
        >
          Escolha o plano ideal para viver cada detalhe do seu casamento.
        </h1>

        <p style={{ fontSize: 'clamp(15px, 1.6vw, 18px)', color: 'var(--muted-fg)', marginTop: '18px', lineHeight: 1.6, maxWidth: '560px' }}>
          Comece gratuitamente e evolua conforme o seu planejamento cresce.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center" style={{ marginTop: '32px' }}>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full font-semibold"
            style={{
              background: 'var(--wedding-color)',
              color: '#FFFFFF',
              padding: '14px 30px',
              fontSize: '15px',
              textDecoration: 'none',
              boxShadow: '0 14px 30px rgba(198,148,58,0.28)',
            }}
          >
            Começar grátis
          </Link>
          <a
            href="#planos"
            className="inline-flex items-center justify-center font-semibold"
            style={{ color: 'var(--fg)', padding: '14px 18px', fontSize: '15px', textDecoration: 'none' }}
          >
            Conhecer planos
          </a>
        </div>
      </section>

      {/* Cards de planos */}
      <section id="planos" className="mx-auto" style={{ maxWidth: '1240px', padding: '0 clamp(20px, 4vw, 44px) clamp(40px, 6vw, 72px)' }}>
        <PublicPlanCards plans={plans} categories={planCategories} features={planFeatures} values={planValues} />
      </section>

      <PlanBenefitsSection />
      <PlanComparisonRich plans={plans} categories={planCategories} features={planFeatures} values={planValues} />
      <PlanFaqSection />

      {/* Rodapé */}
      <footer
        className="mx-auto flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left"
        style={{
          maxWidth: '1240px',
          padding: 'clamp(24px, 3vw, 32px) clamp(20px, 4vw, 44px) clamp(40px, 5vw, 56px)',
          borderTop: '1px solid color-mix(in srgb, var(--wedding-color) 12%, transparent)',
          marginTop: 'clamp(24px, 3vw, 32px)',
        }}
      >
        <span className="font-display" style={{ fontSize: '16px', fontWeight: 500, color: 'var(--wedding-color-dark)' }}>
          Wednest
        </span>
        <span style={{ fontSize: '13px', color: 'var(--muted-fg)' }}>
          © {new Date().getFullYear()} Wednest. Todos os direitos reservados.
        </span>
      </footer>
    </div>
  )
}

function WednestMark() {
  return (
    <svg width="30" height="22" viewBox="0 0 76 56" fill="none">
      <defs>
        <linearGradient id="planos-mark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--wedding-color-light)" />
          <stop offset="100%" stopColor="var(--wedding-color)" />
        </linearGradient>
      </defs>
      <circle cx="28" cy="28" r="17" stroke="url(#planos-mark-grad)" strokeWidth="5" fill="none" />
      <circle cx="48" cy="28" r="17" stroke="url(#planos-mark-grad)" strokeWidth="5" fill="none" />
    </svg>
  )
}
