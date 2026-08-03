import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase/server'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { WEDDING_MODULE_LABELS } from '@/constants/wedding-modules'
import type { PlanId } from '@/constants/plans'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'
import type { WeddingModuleKey } from '@/types/database'

// Cada módulo do casamento pode ser liberado por plano — configurável em
// /admin/planos/modulos (tabela plan_module_access), não mais hardcoded aqui.
export type PaywallFeature = WeddingModuleKey

const FEATURE_DESCRIPTIONS: Record<WeddingModuleKey, string> = {
  checklist:  'Checklist inteligente e timeline do casamento, com tarefas organizadas por fase e prazos automáticos.',
  convidados: 'Gerencie a lista de convidados, RSVP online e confirmações de presença.',
  financeiro: 'Controle o orçamento do casamento, lançamentos, parcelas e fornecedores.',
  mesas:      'Monte o mapa de mesas da festa arrastando convidados, controle a capacidade de cada mesa e garanta que ninguém fique sem lugar.',
  site:       'Crie um site lindo para o seu casamento com história, cerimônia, lista de presentes, galeria e confirmação de presença online.',
  arquivos:   'Guarde contratos, orçamentos e documentos importantes do casamento em um só lugar, com backup seguro.',
  presentes:  'Monte a lista de presentes do casamento, organize preço e loja de cada item e marque manualmente o que já foi dado por convidados.',
  padrinhos:  'Organize padrinhos, madrinhas e a ordem de entrada da cerimônia.',
  checkin:    'Gere o ingresso com QR code de cada convidado confirmado e valide a entrada deles no dia do casamento.',
  album:      'Compartilhe um QR code no salão para os convidados enviarem fotos do casamento em tempo real, direto do celular.',
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
 * Bloqueia `children` para quem está num plano que não libera este módulo (ver
 * plan_module_access, editável em /admin/planos/modulos). Busca a assinatura ativa
 * do usuário (mesmo padrão do layout de (app)); sem assinatura ativa, assume o
 * plano Gratuito. Módulo sem linha em plan_module_access é tratado como liberado
 * (fail-open) — evita travar todo mundo por acidente se um módulo novo ficar sem
 * seed (a migration/trigger já cobrem isso, mas não custa a defesa extra).
 */
export default async function PaywallGate({ feature, children }: PaywallGateProps) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  let planId: PlanId = 'free'
  if (user) {
    const wedding = await getUserWedding(supabase, user.id)
    planId = wedding ? await resolveWeddingPlanId(supabase, wedding.id) : 'free'
  }

  const { data: accessRow } = await supabase
    .from('plan_module_access')
    .select('enabled')
    .eq('plan_id', planId)
    .eq('module', feature)
    .maybeSingle()

  const allowed = accessRow?.enabled ?? true
  if (allowed) return <>{children}</>

  // Quais planos ativos liberam este módulo — pra dizer pro casal pra onde fazer
  // upgrade, sem hardcoded "Premium"/"Premium Plus" (o catálogo é dinâmico).
  const { data: enablingRows } = await supabase
    .from('plan_module_access')
    .select('plans!inner(name, is_active)')
    .eq('module', feature)
    .eq('enabled', true)
    .eq('plans.is_active', true)

  const planNames = [...new Set(
    (enablingRows ?? []).map((row) => (row.plans as unknown as { name: string }).name),
  )]
  const availabilityText = planNames.length > 0
    ? `Disponível n${planNames.length > 1 ? 'os planos' : 'o plano'} ${planNames.join(', ')}.`
    : 'Não disponível em nenhum plano ativo no momento.'

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <div
        className="relative w-full overflow-hidden rounded-2xl p-8 text-center sm:p-10"
        style={{
          maxWidth: '520px',
          background: 'linear-gradient(150deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))',
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
            <StarIcon /> Recurso exclusivo
          </div>

          <h2
            className="font-display"
            style={{ fontSize: 'clamp(24px,3.4vw,30px)', fontWeight: 500, color: '#FAF0E6', lineHeight: 1.15, marginBottom: '10px' }}
          >
            {WEDDING_MODULE_LABELS[feature]}
          </h2>

          <p style={{ fontSize: '14px', color: 'rgba(250,240,230,0.65)', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: '400px' }}>
            {FEATURE_DESCRIPTIONS[feature]} {availabilityText}
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
