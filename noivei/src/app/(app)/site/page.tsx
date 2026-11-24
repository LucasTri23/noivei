import { resolveSiteTemplate } from '@/lib/site/templates'
import PaywallGate from '@/components/billing/paywall-gate'
import ModuleAccessGate from '@/components/billing/module-access-gate'
import SiteBuilder from '@/components/site/site-builder'
import { checkStorageLimit, resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { GuestStatus, SiteConfig } from '@/types/database'

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

  // Contagens das abas "Confirmar presença" e "Lista de presentes" — só colunas mínimas,
  // a RLS já restringe ao casamento do usuário.
  const [{ data: site }, limitCheck, planId, { data: guests }, { data: gifts }] = await Promise.all([
    supabase
      .from('site_config')
      .select('*')
      .eq('wedding_id', weddingId)
      .maybeSingle(),
    checkStorageLimit(supabase, weddingId, 0),
    resolveWeddingPlanId(supabase, weddingId),
    supabase.from('guests').select('status').eq('wedding_id', weddingId),
    supabase.from('gift_registry_items').select('is_purchased').eq('wedding_id', weddingId),
  ])

  const guestStatuses = (guests ?? []).map((guest) => guest.status as GuestStatus)
  const rsvpStats = {
    total:     guestStatuses.length,
    confirmed: guestStatuses.filter((status) => status === 'confirmado').length,
    declined:  guestStatuses.filter((status) => status === 'recusado').length,
    pending:   guestStatuses.filter((status) => status === 'pendente').length,
  }
  const giftStats = {
    total:     (gifts ?? []).length,
    purchased: (gifts ?? []).filter((gift) => gift.is_purchased === true).length,
  }

  return (
    <SiteBuilder
      weddingId={weddingId}
      coupleNames={wedding.couple_names as string}
      initialSite={site ? { ...(site as SiteConfig), template: resolveSiteTemplate(site.template, planId) } : null}
      planId={planId}
      storageLimitBytes={limitCheck.limit}
      storageUsedBytes={limitCheck.current}
      rsvpStats={rsvpStats}
      giftStats={giftStats}
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
