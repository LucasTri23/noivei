import { redirect } from 'next/navigation'
import VendorOnboardingWizard from '@/components/vendors/onboarding/vendor-onboarding-wizard'
import { createSupabaseServer } from '@/lib/supabase/server'
import type {
  MarketplaceVendorStatus,
  VendorCategory,
  VendorCategoryLink,
  VendorPortfolioItem,
  VendorProfile,
} from '@/types/database'

export const metadata = { robots: { index: false, follow: false } }

// Estados sem nada acionável no wizard de cadastro — manda pra página de status.
// 'draft' e 'rejected' continuam usando o wizard (retomar do que já foi preenchido /
// corrigir e reenviar); os demais são geridos só por admin (fase futura) e não têm
// nenhum passo de wizard fazendo sentido. Ver decisão completa no relatório da fase.
const NON_EDITABLE_STATUSES: MarketplaceVendorStatus[] = ['pending_review', 'active', 'paused', 'suspended']

export default async function VendorCadastroPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: vendorData } = await supabase
    .from('vendor_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const vendor = vendorData as VendorProfile | null

  if (vendor && NON_EDITABLE_STATUSES.includes(vendor.status)) {
    redirect('/fornecedor')
  }

  let categoryLinks:  VendorCategoryLink[]    = []
  let portfolioItems: VendorPortfolioItem[]   = []

  if (vendor) {
    const [{ data: linksData }, { data: portfolioData }] = await Promise.all([
      supabase.from('vendor_category_links').select('*').eq('vendor_id', vendor.id),
      supabase.from('vendor_portfolio_items').select('*').eq('vendor_id', vendor.id).order('sort_order'),
    ])
    categoryLinks  = (linksData ?? [])    as VendorCategoryLink[]
    portfolioItems = (portfolioData ?? []) as VendorPortfolioItem[]
  }

  const { data: categoriesData } = await supabase
    .from('vendor_categories')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  return (
    <VendorOnboardingWizard
      initialProfile={vendor}
      initialCategoryIds={categoryLinks.map((link) => link.category_id)}
      initialPortfolioItems={portfolioItems}
      categories={(categoriesData ?? []) as VendorCategory[]}
    />
  )
}
