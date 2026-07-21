import PaywallGate from '@/components/billing/paywall-gate'
import SiteBuilder from '@/components/site/site-builder'
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

  const { data: site } = await supabase
    .from('site_config')
    .select('*')
    .eq('wedding_id', weddingId)
    .maybeSingle()

  return (
    <SiteBuilder
      weddingId={weddingId}
      coupleNames={wedding.couple_names as string}
      initialSite={site as SiteConfig | null}
    />
  )
}

export default function SitePage() {
  return (
    <PaywallGate feature="site">
      <SiteContent />
    </PaywallGate>
  )
}
