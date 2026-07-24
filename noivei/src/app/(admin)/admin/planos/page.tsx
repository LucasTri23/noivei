import { createSupabaseServer } from '@/lib/supabase/server'
import AdminPlansManager, { type AdminPlan } from '@/components/admin/admin-plans-manager'

export const metadata = { title: 'Admin · Planos & limites' }

export default async function AdminPlanosPage() {
  const supabase = await createSupabaseServer()

  const [{ data: plans }, { data: limits }] = await Promise.all([
    supabase
      .from('plans')
      .select('id, name, description, price_brl, is_active, group_key, billing_label, billing_note, emoji, highlight, sort_order')
      .order('sort_order', { ascending: true }),
    supabase.from('plan_limits').select('id, plan_id, feature, value').order('feature', { ascending: true }),
  ])

  const initialPlans: AdminPlan[] = (plans ?? []).map((plan) => ({
    id:            plan.id as string,
    name:          plan.name as string,
    description:   plan.description as string | null,
    price_brl:     plan.price_brl as number,
    is_active:     plan.is_active as boolean,
    group_key:     plan.group_key as string | null,
    billing_label: plan.billing_label as string | null,
    billing_note:  plan.billing_note as string | null,
    emoji:         plan.emoji as string,
    highlight:     plan.highlight as boolean,
    sort_order:    plan.sort_order as number,
    limits: (limits ?? [])
      .filter((limit) => limit.plan_id === plan.id)
      .map((limit) => ({ id: limit.id as string, feature: limit.feature as string, value: limit.value as number })),
  }))

  return (
    <div>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: '#2A1E10', margin: '0 0 6px' }}
      >
        Planos & limites
      </h1>
      <p style={{ fontSize: '14.5px', color: '#8A7560', margin: '0 0 28px' }}>
        Edite preço, descrição, ativação e limites de cada plano do catálogo.
      </p>

      <AdminPlansManager initialPlans={initialPlans} />
    </div>
  )
}
