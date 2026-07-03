import { createSupabaseServer } from '@/lib/supabase/server'

function CheckIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
}
function CalIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01"/></svg>
}
function UsersIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function WalletIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
}
function TableIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2M19 18v2"/></svg>
}
function GlobeIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServer()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('couple_names, wedding_date, city')
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const coupleNames  = wedding?.couple_names ?? 'Seu Casamento'
  const weddingDate  = wedding?.wedding_date
    ? new Date(wedding.wedding_date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // Server Component: renderiza por request, então ler o relógio aqui é intencional
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const daysLeft = wedding?.wedding_date
    ? Math.max(0, Math.ceil((new Date(wedding.wedding_date).getTime() - now) / 86400000))
    : null

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--muted-fg)' }}>
          Olá, {coupleNames}
        </div>
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(34px, 4.6vw, 46px)', margin: '2px 0 0', lineHeight: 1.05, color: 'var(--fg)' }}
        >
          {daysLeft !== null ? 'Seu grande dia está chegando' : 'Bem-vindos ao Wednest'}
        </h1>
        {wedding?.city && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '14px', color: 'var(--muted-fg)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {wedding.city}
          </div>
        )}
      </div>

      {/* Countdown + Progress */}
      <div
        className="mb-4 grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        {/* Countdown */}
        <div
          className="relative overflow-hidden rounded-3xl p-8"
          style={{ background: 'linear-gradient(150deg, #2A1E10, #3A2A18)', color: '#FAF0E6' }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 18%, transparent) 1.3px, transparent 1.5px)', backgroundSize: '26px 26px' }}
          />
          <div className="relative">
            <div style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--wedding-color-light)' }}>
              Faltam
            </div>
            {daysLeft !== null ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginTop: '4px' }}>
                <span className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(60px,8vw,88px)', lineHeight: 0.9 }}>
                  {daysLeft}
                </span>
                <span className="font-display" style={{ fontStyle: 'italic', fontSize: '28px', color: 'var(--wedding-color-light)' }}>dias</span>
              </div>
            ) : (
              <p className="font-display mt-2" style={{ fontStyle: 'italic', fontSize: '22px', color: 'var(--wedding-color-light)' }}>
                Adicione a data do casamento nas configurações
              </p>
            )}
            {weddingDate && (
              <div style={{ fontSize: '14px', color: 'rgba(250,240,230,0.65)', marginTop: '6px' }}>
                {weddingDate}
              </div>
            )}
          </div>
        </div>

        {/* Progress circle */}
        <div className="flex flex-col items-center justify-center rounded-3xl bg-[var(--surface)] p-7 text-center" style={{ boxShadow: '0 12px 30px rgba(60,40,24,0.07)' }}>
          <div className="relative" style={{ width: '130px', height: '130px' }}>
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r="54" fill="none" stroke="#EBDDD0" strokeWidth="13" />
              <circle cx="65" cy="65" r="54" fill="none" stroke="var(--wedding-color)" strokeWidth="13" strokeLinecap="round" strokeDasharray="339" strokeDashoffset="339" transform="rotate(-90 65 65)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display" style={{ fontWeight: 600, fontSize: '40px', color: 'var(--fg)' }}>0%</span>
            </div>
          </div>
          <div className="font-display mt-3.5" style={{ fontSize: '23px', color: 'var(--fg)' }}>Planejamento</div>
          <div style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '2px' }}>0 tarefas concluídas</div>
        </div>
      </div>

      {/* Quick links */}
      <div className="rounded-[22px] bg-[var(--surface)] p-6" style={{ boxShadow: '0 10px 26px rgba(60,40,24,0.06)' }}>
        <h3 className="font-display mb-4" style={{ fontWeight: 500, fontSize: '24px', color: 'var(--fg)' }}>
          Sua jornada
        </h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {[
            { href: '/checklist',  label: 'Checklist',    icon: CheckIcon },
            { href: '/timeline',   label: 'Timeline',     icon: CalIcon },
            { href: '/convidados', label: 'Convidados',   icon: UsersIcon },
            { href: '/financeiro', label: 'Financeiro',   icon: WalletIcon },
            { href: '/mesas',      label: 'Mesas',        icon: TableIcon },
            { href: '/site',       label: 'Site do casal', icon: GlobeIcon },
          ].map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="flex flex-col gap-3 rounded-2xl p-4 transition-colors"
              style={{ background: 'var(--wedding-color-subtle)', border: '1px solid #EBDDD0', textDecoration: 'none', color: 'var(--fg)' }}
            >
              <span style={{ color: 'var(--wedding-color)' }}><Icon size={22} /></span>
              <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{label}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
