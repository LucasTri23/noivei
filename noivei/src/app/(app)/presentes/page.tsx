import PaywallGate from '@/components/billing/paywall-gate'
import ModuleAccessGate from '@/components/billing/module-access-gate'
import GiftRegistryManager from '@/components/gifts/gift-registry-manager'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { GiftRegistryItem } from '@/types/database'

export default async function PresentesPage() {
  const supabase = await createSupabaseServer()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id')
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
        Complete o onboarding para começar a montar sua lista de presentes.
      </div>
    )
  }

  const { data: items } = await supabase
    .from('gift_registry_items')
    .select('*')
    .eq('wedding_id', wedding.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <ModuleAccessGate module="presentes">
      <PaywallGate feature="presentes">
        <GiftRegistryManager
          weddingId={wedding.id as string}
          initialItems={(items ?? []) as GiftRegistryItem[]}
        />
      </PaywallGate>
    </ModuleAccessGate>
  )
}
