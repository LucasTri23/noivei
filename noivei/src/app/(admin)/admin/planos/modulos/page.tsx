import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase/server'
import AdminPlanModulesManager from '@/components/admin/admin-plan-modules-manager'
import type { WeddingModuleKey } from '@/types/database'

export const metadata = { title: 'Admin · Módulos por plano' }

export default async function AdminPlanModulesPage() {
  const supabase = await createSupabaseServer()

  const [{ data: plans }, { data: access }] = await Promise.all([
    supabase.from('plans').select('id, name').eq('is_active', true).order('sort_order'),
    supabase.from('plan_module_access').select('plan_id, module, enabled'),
  ])

  return (
    <div>
      <Link href="/admin/planos" style={{ fontSize: '13.5px', color: '#8A7560', textDecoration: 'none' }}>
        ← Planos & limites
      </Link>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: '#2A1E10', margin: '10px 0 6px' }}
      >
        Módulos por plano
      </h1>
      <p style={{ fontSize: '14.5px', color: '#8A7560', margin: '0 0 28px' }}>
        Defina o que cada plano libera de verdade — checklist, convidados, financeiro, mesas, site, arquivos, presentes, padrinhos, check-in e álbum de fotos.
      </p>

      <AdminPlanModulesManager
        plans={(plans ?? []) as { id: string; name: string }[]}
        initialAccess={(access ?? []) as { plan_id: string; module: WeddingModuleKey; enabled: boolean }[]}
      />
    </div>
  )
}
