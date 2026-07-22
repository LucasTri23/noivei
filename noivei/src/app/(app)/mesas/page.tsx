import PaywallGate from '@/components/billing/paywall-gate'
import ModuleAccessGate from '@/components/billing/module-access-gate'
import TablesBoard, { type TableGuest, type TableWithGuests } from '@/components/tables/tables-board'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { TableConfig } from '@/types/database'

interface TableRow extends TableConfig {
  table_assignments: { guest_id: string; guests: TableGuest | null }[]
}

async function MesasContent() {
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
        Complete o onboarding para começar a organizar as mesas.
      </div>
    )
  }

  const weddingId = wedding.id as string

  const [{ data: tablesData }, { data: guestsData }] = await Promise.all([
    supabase
      .from('tables_config')
      .select(
        'id, wedding_id, label, capacity, created_at, table_assignments(guest_id, guests(id, name, group_name))',
      )
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: true }),
    // Mesma lógica do cortejo (Padrinhos & Entradas): só convidado confirmado entra na
    // organização das mesas — sentar alguém que ainda nem confirmou presença não faz
    // sentido, e alguém que recusou não vai estar lá.
    supabase
      .from('guests')
      .select('id, name, group_name')
      .eq('wedding_id', weddingId)
      .eq('status', 'confirmado')
      .order('name', { ascending: true }),
  ])

  const tables: TableWithGuests[] = ((tablesData ?? []) as unknown as TableRow[]).map(
    ({ table_assignments, ...table }) => ({
      ...table,
      guests: table_assignments
        .map((assignment) => assignment.guests)
        .filter((guest): guest is TableGuest => guest !== null),
    }),
  )

  return (
    <TablesBoard
      weddingId={weddingId}
      initialTables={tables}
      confirmedGuests={(guestsData ?? []) as TableGuest[]}
    />
  )
}

export default function MesasPage() {
  return (
    <ModuleAccessGate module="mesas">
      <PaywallGate feature="mesas">
        <MesasContent />
      </PaywallGate>
    </ModuleAccessGate>
  )
}
