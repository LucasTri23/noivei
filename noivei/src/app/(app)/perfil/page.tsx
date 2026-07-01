import { createSupabaseServer } from '@/lib/supabase/server'

function EditIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function ChevronRightIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
}
function BellIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
}
function SunIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
}
function LockIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function HelpIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function CalendarIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
}
function DownloadIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
function TrashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
}
function StarIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
}

const MENU_ITEMS = [
  { label: 'Dados do casamento', icon: <CalendarIcon /> },
  { label: 'Notificações',       icon: <BellIcon /> },
  { label: 'Aparência',          icon: <SunIcon /> },
  { label: 'Segurança',          icon: <LockIcon /> },
  { label: 'Ajuda',              icon: <HelpIcon /> },
]

export default async function PerfilPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('couple_names')
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const coupleNames = wedding?.couple_names ?? 'Meu Casamento'
  const email = user?.email ?? ''
  const planId = subscription?.plan_id ?? 'free'
  const isPremium = planId !== 'free'
  const initial = coupleNames.charAt(0).toUpperCase()

  return (
    <div>
      <div className="mb-6">
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: '#3C2818' }}
        >
          Perfil &amp; configurações
        </h1>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))' }}>
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Profile card */}
          <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.07)' }}>
            <div className="flex items-center gap-4 mb-5">
              <div
                style={{
                  width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(198,148,58,0.22)', color: '#E0B870',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px', fontWeight: 700,
                }}
              >
                {initial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="font-display"
                  style={{ fontSize: '24px', fontWeight: 500, color: '#3C2818', lineHeight: 1.1 }}
                >
                  {coupleNames}
                </div>
                <div style={{ fontSize: '13.5px', color: '#9A7A60', marginTop: '3px', wordBreak: 'break-word' }}>
                  {email}
                </div>
              </div>
            </div>
            <button
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: 'transparent', color: '#C6943A', border: '1.5px solid #C6943A',
                borderRadius: '12px', padding: '10px 16px',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer',
              }}
            >
              <EditIcon /> Editar perfil
            </button>
          </div>

          {/* Menu list */}
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
            {MENU_ITEMS.map((item, idx) => (
              <button
                key={item.label}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 20px', background: 'transparent', border: 'none',
                  borderBottom: idx < MENU_ITEMS.length - 1 ? '1px solid #F8F3EE' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: '#FBF5EE', color: '#C6943A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <span style={{ flex: 1, fontSize: '14.5px', fontWeight: 500, color: '#3C2818' }}>
                  {item.label}
                </span>
                <span style={{ color: '#C8B4A0' }}><ChevronRightIcon /></span>
              </button>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Plan card */}
          <div
            className="relative overflow-hidden rounded-2xl p-6"
            style={{ background: 'linear-gradient(150deg, #2A1E10, #3A2A18)', color: '#FAF0E6' }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: 'radial-gradient(rgba(198,148,58,0.16) 1.3px, transparent 1.5px)', backgroundSize: '26px 26px' }}
            />
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '4px 12px', borderRadius: '99px',
                  background: 'rgba(198,148,58,0.22)', color: '#E0B870',
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', marginBottom: '12px',
                }}
              >
                <StarIcon /> {isPremium ? 'Premium' : 'Gratuito'}
              </div>
              <div
                className="font-display"
                style={{ fontSize: '26px', fontWeight: 500, color: '#FAF0E6', marginBottom: '6px' }}
              >
                {isPremium ? 'Plano Premium ativo' : 'Plano Gratuito'}
              </div>
              <div style={{ fontSize: '13.5px', color: 'rgba(250,240,230,0.65)', marginBottom: '20px', lineHeight: 1.5 }}>
                {isPremium
                  ? 'Acesso completo a todas as funcionalidades do Wednest.'
                  : 'Faça upgrade para desbloquear convidados ilimitados, mesas e muito mais.'}
              </div>
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#E0B870', color: '#2A1E10', border: 'none',
                  borderRadius: '12px', padding: '12px 20px',
                  fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                }}
              >
                {isPremium ? 'Gerenciar assinatura' : 'Ver planos'}
              </button>
            </div>
          </div>

          {/* LGPD card */}
          <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
            <h3 className="font-display mb-4" style={{ fontSize: '20px', fontWeight: 500, color: '#3C2818' }}>
              Privacidade (LGPD)
            </h3>
            <div className="flex flex-col gap-3">
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '13px 16px', borderRadius: '12px',
                  border: '1.5px solid #EBDDD0', background: 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ color: '#C6943A' }}><DownloadIcon /></span>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#C6943A' }}>
                  Exportar meus dados
                </span>
              </button>
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '13px 16px', borderRadius: '12px',
                  border: '1.5px solid #F2DADA', background: 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ color: '#C0553F' }}><TrashIcon /></span>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#C0553F' }}>
                  Excluir minha conta
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
