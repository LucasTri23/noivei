import CheckinScanner from '@/components/checkin/checkin-scanner'
import ModuleAccessGate from '@/components/billing/module-access-gate'
import PaywallGate from '@/components/billing/paywall-gate'
import { createSupabaseServer } from '@/lib/supabase/server'

async function CheckinContent() {
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
        Complete o onboarding para liberar o check-in do dia do casamento.
      </div>
    )
  }

  const weddingId = wedding.id as string

  const [{ count: confirmedCount }, { count: arrivedCount }] = await Promise.all([
    supabase
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('wedding_id', weddingId)
      .eq('status', 'confirmado'),
    supabase
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('wedding_id', weddingId)
      .not('checked_in_at', 'is', null),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
        >
          Portaria
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
          Aponte a câmera para o QR code do ingresso de cada convidado na entrada.
        </p>
      </div>

      <CheckinScanner
        weddingId={weddingId}
        initialConfirmedTotal={confirmedCount ?? 0}
        initialArrivedCount={arrivedCount ?? 0}
      />
    </div>
  )
}

export default function CheckinPage() {
  return (
    <ModuleAccessGate module="checkin">
      <PaywallGate feature="checkin">
        <CheckinContent />
      </PaywallGate>
    </ModuleAccessGate>
  )
}
