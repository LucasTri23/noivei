import WeddingPartyManager, {
  type ConfirmedGuest,
  type WeddingPartyEntryWithGuest,
} from '@/components/wedding-party/wedding-party-manager'
import ModuleAccessGate from '@/components/billing/module-access-gate'
import { checkWeddingPartyLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { WeddingPartyEntry } from '@/types/database'

interface EntryRow extends WeddingPartyEntry {
  guests: { name: string } | null
}

async function PadrinhosContent() {
  const supabase = await createSupabaseServer()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, bride_name, groom_name, groom_entrance_position, bride_entrance_position')
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
        Complete o onboarding para começar a montar o cortejo.
      </div>
    )
  }

  const weddingId = wedding.id as string
  // Nome fixo, não editável por aqui — nome real se disponível, senão um rótulo
  // genérico (edição de bride_name/groom_name fica em Perfil > Dados do casamento).
  const groomLabel = (wedding.groom_name as string | null) || 'Noivo'
  const brideLabel = (wedding.bride_name as string | null) || 'Noiva'

  // Não exige RSVP confirmado pra entrar no cortejo — padrinho é papel de
  // organização, independente de já ter confirmado presença.
  const [{ data: confirmedGuests }, { data: entriesData }, limitCheck] = await Promise.all([
    supabase
      .from('guests')
      .select('id, name, status')
      .eq('wedding_id', weddingId)
      .order('name', { ascending: true }),
    supabase
      .from('wedding_party_entries')
      .select('*, guests(name)')
      .eq('wedding_id', weddingId)
      .order('sort_order', { ascending: true }),
    checkWeddingPartyLimit(supabase, weddingId),
  ])

  const entries: WeddingPartyEntryWithGuest[] = ((entriesData ?? []) as unknown as EntryRow[]).map(
    ({ guests, ...entry }) => ({ ...entry, guest_name: guests?.name ?? '' }),
  )

  return (
    <WeddingPartyManager
      weddingId={weddingId}
      initialEntries={entries}
      confirmedGuests={(confirmedGuests ?? []) as ConfirmedGuest[]}
      entryLimit={limitCheck.limit}
      groomLabel={groomLabel}
      brideLabel={brideLabel}
      groomEntrancePosition={wedding.groom_entrance_position as number}
      brideEntrancePosition={wedding.bride_entrance_position as number}
    />
  )
}

export default function PadrinhosPage() {
  return (
    <ModuleAccessGate module="padrinhos">
      <PadrinhosContent />
    </ModuleAccessGate>
  )
}
