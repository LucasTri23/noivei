import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { PLAN_IDS, type PlanId } from '@/constants/plans'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'
import PlanSelector from '@/components/perfil/plan-selector'
import type { PlanFeature, PlanFeatureCategory, PlanFeatureValue } from '@/types/database'

export const metadata = { title: 'Planos' }

const DISPLAYED_PLAN_IDS: PlanId[] = [
  PLAN_IDS.FREE, PLAN_IDS.PREMIUM_MONTHLY, PLAN_IDS.PREMIUM_ONCE, PLAN_IDS.PLUS_ONCE,
]

export default async function PlanosPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // A assinatura pertence ao dono do casamento — um membro convidado tem a própria
  // conta (e a própria assinatura Gratuita padrão), sem relação com o plano do
  // casamento em que foi incluído, então esta tela não faz sentido pra ele.
  const wedding = await getUserWedding(supabase, user.id)
  if (!wedding || !wedding.isOwner) {
    return (
      <div>
        <Link href="/perfil" style={{ fontSize: '13.5px', color: 'var(--muted-fg)', textDecoration: 'none' }}>
          ← Voltar ao perfil
        </Link>
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: 'var(--fg)', margin: '10px 0 6px' }}
        >
          Planos
        </h1>
        <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
          <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 18px', lineHeight: 1.6 }}>
            Só o dono do casamento pode gerenciar o plano e a assinatura. Fale com quem
            criou o espaço do casal para fazer upgrade ou alterar o plano.
          </p>
          <Link
            href="/perfil"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'var(--wedding-color)', color: '#fff', textDecoration: 'none',
              borderRadius: '12px', padding: '11px 20px', fontWeight: 600, fontSize: '14px',
            }}
          >
            Voltar ao perfil
          </Link>
        </div>
      </div>
    )
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, plan_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Preços vêm do banco (tabela `plans`), nunca hardcoded — o painel /admin/planos
  // edita isso e reflete aqui sem deploy. A tabela de comparação (categorias/linhas/
  // valores) também vem do banco agora — editável em /admin/planos/features.
  const [{ data: plans }, { data: categories }, { data: features }, { data: values }] = await Promise.all([
    supabase.from('plans').select('id, price_brl').in('id', DISPLAYED_PLAN_IDS),
    supabase.from('plan_feature_categories').select('*').order('sort_order'),
    supabase.from('plan_features').select('*').order('sort_order'),
    supabase.from('plan_feature_values').select('*'),
  ])

  const prices = Object.fromEntries(
    (plans ?? []).map((p) => [p.id, p.price_brl as number]),
  ) as Record<PlanId, number>

  const currentPlanId = (subscription?.plan_id ?? 'free') as PlanId

  return (
    <div>
      <Link href="/perfil" style={{ fontSize: '13.5px', color: 'var(--muted-fg)', textDecoration: 'none' }}>
        ← Voltar ao perfil
      </Link>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: 'var(--fg)', margin: '10px 0 6px' }}
      >
        Planos
      </h1>
      <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 28px' }}>
        Compare os planos e escolha o ideal para o casamento de vocês. Você pode mudar quando quiser.
      </p>

      <PlanSelector
        userId={user.id}
        currentPlanId={currentPlanId}
        subscriptionId={subscription?.id ?? null}
        prices={prices}
        categories={(categories ?? []) as PlanFeatureCategory[]}
        features={(features ?? []) as PlanFeature[]}
        values={(values ?? []) as PlanFeatureValue[]}
      />
    </div>
  )
}
