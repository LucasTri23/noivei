import GuestsManager from '@/components/guests/guests-manager'
import ModuleAccessGate from '@/components/billing/module-access-gate'
import PaywallGate from '@/components/billing/paywall-gate'
import { checkGuestLimit, resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { Guest } from '@/types/database'

async function ConvidadosContent() {
  const supabase = await createSupabaseServer()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, rsvp_message_template, couple_names, wedding_color, wedding_color_secondary')
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

  const weddingId = wedding.id as string

  const [{ data: guests }, limitCheck, planId] = await Promise.all([
    supabase
      .from('guests')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('name', { ascending: true }),
    checkGuestLimit(supabase, weddingId),
    resolveWeddingPlanId(supabase, weddingId),
  ])

  // Mesma lógica/fail-open do PaywallGate (linha ausente em plan_module_access =
  // liberado) — aqui só decide se o botão de enviar ingresso aparece na lista,
  // não substitui o PaywallGate/ModuleAccessGate da própria página de Check-in.
  const { data: checkinAccessRow } = await supabase
    .from('plan_module_access')
    .select('enabled')
    .eq('plan_id', planId)
    .eq('module', 'checkin')
    .maybeSingle()
  const checkinEnabled = checkinAccessRow?.enabled ?? true

  return (
    <GuestsManager
      weddingId={weddingId}
      initialGuests={(guests ?? []) as Guest[]}
      guestLimit={limitCheck.limit}
      rsvpMessageTemplate={wedding.rsvp_message_template as string | null}
      coupleNames={wedding.couple_names as string}
      weddingColor={wedding.wedding_color as string}
      weddingColorSecondary={wedding.wedding_color_secondary as string}
      checkinEnabled={checkinEnabled}
    />
  )
}

export default function ConvidadosPage() {
  return (
    <ModuleAccessGate module="convidados">
      <PaywallGate feature="convidados">
        <ConvidadosContent />
      </PaywallGate>
    </ModuleAccessGate>
  )
}
