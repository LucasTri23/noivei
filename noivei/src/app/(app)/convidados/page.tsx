import GuestsManager from '@/components/guests/guests-manager'
import ModuleAccessGate from '@/components/billing/module-access-gate'
import { checkGuestLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { Guest } from '@/types/database'

async function ConvidadosContent() {
  const supabase = await createSupabaseServer()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, rsvp_message_template')
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
        Complete o onboarding para começar a montar sua lista de convidados.
      </div>
    )
  }

  const [{ data: guests }, limitCheck] = await Promise.all([
    supabase
      .from('guests')
      .select('*')
      .eq('wedding_id', wedding.id)
      .order('name', { ascending: true }),
    checkGuestLimit(supabase, wedding.id as string),
  ])

  return (
    <GuestsManager
      weddingId={wedding.id as string}
      initialGuests={(guests ?? []) as Guest[]}
      guestLimit={limitCheck.limit}
      rsvpMessageTemplate={wedding.rsvp_message_template as string | null}
    />
  )
}

export default function ConvidadosPage() {
  return (
    <ModuleAccessGate module="convidados">
      <ConvidadosContent />
    </ModuleAccessGate>
  )
}
