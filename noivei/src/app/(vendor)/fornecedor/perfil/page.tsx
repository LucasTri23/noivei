import { redirect } from 'next/navigation'
import VendorProfileManager from '@/components/vendors/dashboard/vendor-profile-manager'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorPortfolioItem, VendorProfile } from '@/types/database'

// Fase 6 (painel completo do fornecedor): edição comercial pós-onboarding +
// gestão do portfólio (upload, reordenar, excluir) — antes desta página, um
// fornecedor 'active' não tinha NENHUMA forma de editar o próprio perfil ou
// portfólio depois do wizard de cadastro (só draft/rejected reabriam o wizard, ver
// STATUS_COPY em .../fornecedor/page.tsx).
export const metadata = { robots: { index: false, follow: false } }

export default async function VendorPerfilPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('vendor_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) redirect('/fornecedor/cadastro')

  const { data: portfolioItems } = await supabase
    .from('vendor_portfolio_items')
    .select('*')
    .eq('vendor_id', profile.id)
    .order('sort_order')

  return (
    <div>
      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(24px,3.2vw,30px)', margin: '0 0 22px', color: 'var(--fg)' }}>
        Meu perfil
      </h1>

      <VendorProfileManager
        profile={profile as VendorProfile}
        initialPortfolioItems={(portfolioItems ?? []) as VendorPortfolioItem[]}
      />
    </div>
  )
}
