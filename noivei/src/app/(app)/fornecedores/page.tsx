import ModuleAccessGate from '@/components/billing/module-access-gate'
import VendorCard from '@/components/vendors/vendor-card'
import VendorMarketplaceEmptyState from '@/components/vendors/vendor-marketplace-empty-state'
import VendorMarketplaceFilterBar from '@/components/vendors/vendor-marketplace-filter-bar'
import { createSupabaseServer } from '@/lib/supabase/server'
import { listActiveVendorCategories, listVendors } from '@/lib/vendor/list-vendors'
import { hasActiveVendorFilters, parseVendorMarketplaceFilters } from '@/lib/vendor/marketplace-filters'

interface FornecedoresPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Marketplace de fornecedores do casal — SEM PaywallGate de propósito (ver
// vendor_profiles/plan_module_access na migration 20260806000002: 'fornecedores'
// nunca tem linha em plan_module_access, é liberado em TODO plano; só
// ModuleAccessGate, que trava por permissão de MEMBRO, não por plano). Nunca
// envolver este módulo em PaywallGate — decisão de produto já tomada na Fase 1.
async function FornecedoresContent({ searchParams }: FornecedoresPageProps) {
  const supabase   = await createSupabaseServer()
  const rawParams  = await searchParams
  const filters    = parseVendorMarketplaceFilters(rawParams)
  const hasFilters = hasActiveVendorFilters(filters)

  const [categories, vendors] = await Promise.all([
    listActiveVendorCategories(supabase),
    listVendors(supabase, filters),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
        >
          Fornecedores
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
          Encontre fornecedores para o seu casamento e entre em contato direto pelo WhatsApp.
        </p>
      </div>

      <VendorMarketplaceFilterBar categories={categories} filters={filters} />

      {vendors.length === 0 ? (
        <VendorMarketplaceEmptyState hasFilters={hasFilters} />
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))' }}>
          {vendors.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FornecedoresPage(props: FornecedoresPageProps) {
  return (
    <ModuleAccessGate module="fornecedores">
      <FornecedoresContent {...props} />
    </ModuleAccessGate>
  )
}
