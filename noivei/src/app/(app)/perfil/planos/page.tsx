import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { PlanId } from '@/constants/plans'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'
import PlanSelector from '@/components/perfil/plan-selector'
import type { PlanFeature, PlanFeatureCategory, PlanFeatureValue } from '@/types/database'

export const metadata = { title: 'Planos' }

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

  // Catálogo inteiro vem do banco (tabela `plans`, só os ativos) — nada de lista fixa
  // de ids: um plano novo criado em /admin/planos aparece aqui sozinho, sem deploy.
  // A tabela de comparação (categorias/linhas/valores) também vem do banco, editável
  // em /admin/planos/features.
  const [{ data: plansData }, { data: categories }, { data: features }, { data: values }] = await Promise.all([
    supabase
      .from('plans')
      .select('id, name, description, price_brl, group_key, billing_label, billing_note, emoji, highlight')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('plan_feature_categories').select('*').order('sort_order'),
    supabase.from('plan_features').select('*').order('sort_order'),
    supabase.from('plan_feature_values').select('*'),
  ])

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
        plans={plansData ?? []}
        categories={(categories ?? []) as PlanFeatureCategory[]}
        features={(features ?? []) as PlanFeature[]}
        values={(values ?? []) as PlanFeatureValue[]}
      />
    </div>
  )
}
