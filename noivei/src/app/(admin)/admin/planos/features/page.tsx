import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase/server'
import AdminPlanFeaturesManager from '@/components/admin/admin-plan-features-manager'
import { effectiveGroupKey } from '@/lib/billing/plan-groups'
import type { PlanFeature, PlanFeatureCategory, PlanFeatureValue } from '@/types/database'

export const metadata = { title: 'Admin · Tabela de comparação' }

export default async function AdminPlanFeaturesPage() {
  const supabase = await createSupabaseServer()

  const [{ data: categories }, { data: features }, { data: values }, { data: plans }] = await Promise.all([
    supabase.from('plan_feature_categories').select('*').order('sort_order'),
    supabase.from('plan_features').select('*').order('sort_order'),
    supabase.from('plan_feature_values').select('*'),
    supabase.from('plans').select('id, name, group_key').eq('is_active', true).order('sort_order'),
  ])

  // Uma coluna por group_key distinto entre os planos ativos — não mais fixo em
  // free/premium/plus. O rótulo da coluna usa o nome do primeiro plano daquele grupo.
  const groupsSeen = new Set<string>()
  const groups: { key: string; label: string }[] = []
  for (const plan of (plans ?? []) as { id: string; name: string; group_key: string | null }[]) {
    const key = effectiveGroupKey(plan)
    if (groupsSeen.has(key)) continue
    groupsSeen.add(key)
    groups.push({ key, label: plan.name })
  }

  return (
    <div>
      <Link href="/admin/planos" style={{ fontSize: '13.5px', color: '#8A7560', textDecoration: 'none' }}>
        ← Planos & limites
      </Link>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: '#2A1E10', margin: '10px 0 6px' }}
      >
        Tabela de comparação
      </h1>
      <p style={{ fontSize: '14.5px', color: '#8A7560', margin: '0 0 28px' }}>
        Recursos exibidos lado a lado na tela de planos do casal (/perfil/planos).
      </p>

      <AdminPlanFeaturesManager
        groups={groups}
        initialCategories={(categories ?? []) as PlanFeatureCategory[]}
        initialFeatures={(features ?? []) as PlanFeature[]}
        initialValues={(values ?? []) as PlanFeatureValue[]}
      />
    </div>
  )
}
