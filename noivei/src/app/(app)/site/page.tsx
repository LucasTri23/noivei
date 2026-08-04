import PaywallGate from '@/components/billing/paywall-gate'
import ModuleAccessGate from '@/components/billing/module-access-gate'
import SiteBuilder from '@/components/site/site-builder'
import { checkStorageLimit, resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { SiteConfig } from '@/types/database'

async function SiteContent() {
  const supabase = await createSupabaseServer()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, couple_names')
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!wedding) {
    return (
      <div
        className="rounded-2xl bg-[var(--surface)] p-10 text-center"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: 'var(--muted-fg)', fontSize: '14px' }}
      >
        Complete o onboarding para começar a montar o site do casal.
      </div>
    )
  }

  const weddingId = wedding.id as string

  const [{ data: site }, limitCheck, planId] = await Promise.all([
    supabase
      .from('site_config')
      .select('*')
      .eq('wedding_id', weddingId)
      .maybeSingle(),
    checkStorageLimit(supabase, weddingId, 0),
    resolveWeddingPlanId(supabase, weddingId),
  ])

  // Mesma lógica/fail-open do PaywallGate (linha ausente em plan_module_access =
  // liberado) — decide só se o template "portfolio" aparece selecionável no
  // seletor de estilo; o fail-safe de verdade (nunca confiar no valor salvo)
  // mora na leitura pública (ver get-public-site-by-slug.ts).
  const { data: albumAccessRow } = await supabase
    .from('plan_module_access')
    .select('enabled')
    .eq('plan_id', planId)
    .eq('module', 'album')
    .maybeSingle()
  const albumEnabled = albumAccessRow?.enabled ?? true

  return (
    <SiteBuilder
      weddingId={weddingId}
      coupleNames={wedding.couple_names as string}
      initialSite={site as SiteConfig | null}
      storageLimitBytes={limitCheck.limit}
      storageUsedBytes={limitCheck.current}
      albumEnabled={albumEnabled}
    />
  )
}

export default function SitePage() {
  return (
    <ModuleAccessGate module="site">
      <PaywallGate feature="site">
        <SiteContent />
      </PaywallGate>
    </ModuleAccessGate>
  )
}
