import Link from 'next/link'
import CountdownCard from '@/components/dashboard/countdown-card'
import { createSupabaseServer } from '@/lib/supabase/server'
import { isPaidPlan, type PlanId } from '@/constants/plans'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { recalculateWeddingScore } from '@/lib/wedding-score/recalculate'

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
function LockIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}

interface WeddingScoreMeta {
  label:       string
  description: string
  color:       string
  bg:          string
}

// Faixas do Wedding Score: <40 início de jornada, 40-70 andamento, 70+ reta final
function weddingScoreMeta(score: number): WeddingScoreMeta {
  if (score >= 70) {
    return { label: 'Quase lá', description: 'Seu planejamento está bem encaminhado.', color: '#5E8B6A', bg: '#E9EFE6' }
  }
  if (score >= 40) {
    return { label: 'No caminho', description: 'Vocês estão avançando bem, continue assim.', color: '#9A7020', bg: '#FBF0E0' }
  }
  return { label: 'Início de jornada', description: 'Ainda no começo — cada passo conta.', color: '#C0553F', bg: '#F6E4DE' }
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, couple_names, wedding_date, city')
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

  // Progresso real do checklist + indicadores de notificação
  let checklistTotal = 0
  let checklistDone  = 0
  let overdueTasks   = 0
  let pendingGuests  = 0
  let confirmedGuests = 0
  let upcomingTasks: { id: string; label: string; due_date: string | null }[] = []
  let notifyTimeline = true
  let notifyRsvp     = true
  let planId: PlanId = 'free'

  // Perfil de notificações (depende de user) e plano do casamento (depende de wedding)
  // não dependem um do outro — rodam em paralelo em vez de sequenciais.
  const [profileResult, resolvedPlanId] = await Promise.all([
    user
      ? supabase.from('profiles').select('notify_timeline, notify_rsvp').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    wedding?.id ? resolveWeddingPlanId(supabase, wedding.id) : Promise.resolve('free' as PlanId),
  ])

  const profile = profileResult.data
  notifyTimeline = (profile?.notify_timeline as boolean | undefined) ?? true
  notifyRsvp     = (profile?.notify_rsvp as boolean | undefined) ?? true
  planId         = resolvedPlanId

  // Wedding Score é recurso pago: recalcula a cada carregamento (barato, poucas queries agregadas)
  const weddingScore = wedding?.id && isPaidPlan(planId)
    ? await recalculateWeddingScore(supabase, wedding.id)
    : null

  if (wedding?.id) {
    const today = new Date(now).toLocaleDateString('sv-SE') // yyyy-mm-dd local

    const [{ data: tasks }, { count: pendingCount }, { count: confirmedCount }, { data: upcoming }] = await Promise.all([
      supabase
        .from('checklist_items')
        .select('completed, due_date')
        .eq('wedding_id', wedding.id)
        .eq('is_archived', false)
        .eq('is_dismissed', false),
      supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .eq('wedding_id', wedding.id)
        .eq('status', 'pendente'),
      supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .eq('wedding_id', wedding.id)
        .eq('status', 'confirmado'),
      supabase
        .from('checklist_items')
        .select('id, label, due_date')
        .eq('wedding_id', wedding.id)
        .eq('completed', false)
        .eq('is_archived', false)
        .eq('is_dismissed', false)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .limit(4),
    ])

    const items = (tasks ?? []) as { completed: boolean; due_date: string | null }[]
    checklistTotal  = items.length
    checklistDone   = items.filter((t) => t.completed).length
    overdueTasks    = items.filter((t) => !t.completed && t.due_date !== null && t.due_date < today).length
    pendingGuests   = pendingCount ?? 0
    confirmedGuests = confirmedCount ?? 0
    upcomingTasks   = (upcoming ?? []) as { id: string; label: string; due_date: string | null }[]
  }

  const progressPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0
  // Círculo de progresso: circunferência ≈ 339 (r=54)
  const dashOffset = Math.round(339 - (339 * progressPct) / 100)

  const banners = [
    ...(notifyTimeline && overdueTasks > 0
      ? [{
          key:   'overdue',
          href:  '/checklist',
          text:  overdueTasks === 1
            ? '1 tarefa do checklist está atrasada'
            : `${overdueTasks} tarefas do checklist estão atrasadas`,
          cta:   'Ver checklist',
          color: '#C0553F', bg: '#F6E4DE', border: '#E8C4B8',
        }]
      : []),
    ...(notifyRsvp && pendingGuests > 0
      ? [{
          key:   'pending-rsvp',
          href:  '/convidados',
          text:  pendingGuests === 1
            ? '1 convidado ainda não confirmou presença'
            : `${pendingGuests} convidados ainda não confirmaram presença`,
          cta:   'Ver convidados',
          color: '#9A7020', bg: '#FBF0E0', border: '#E0B870',
        }]
      : []),
  ]

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

      {/* Notificações no app (respeitam profiles.notify_timeline / notify_rsvp) */}
      {banners.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          {banners.map((banner) => (
            <a
              key={banner.key}
              href={banner.href}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
              style={{
                background: banner.bg, border: `1px solid ${banner.border}`,
                textDecoration: 'none',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: banner.color }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
                {banner.text}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: banner.color, textDecoration: 'underline' }}>
                {banner.cta}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Countdown + Progress */}
      <div
        className="mb-4 grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        {/* Countdown — dias/horas/min/seg, ticando ao vivo (client component) */}
        <CountdownCard weddingDate={wedding?.wedding_date ?? null} formattedDate={weddingDate} />

        {/* Progress circle */}
        <div className="flex flex-col items-center justify-center rounded-3xl bg-[var(--surface)] p-7 text-center" style={{ boxShadow: '0 12px 30px rgba(60,40,24,0.07)' }}>
          <div className="relative" style={{ width: '130px', height: '130px' }}>
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r="54" fill="none" stroke="#EBDDD0" strokeWidth="13" />
              <circle cx="65" cy="65" r="54" fill="none" stroke="var(--wedding-color)" strokeWidth="13" strokeLinecap="round" strokeDasharray="339" strokeDashoffset={dashOffset} transform="rotate(-90 65 65)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display" style={{ fontWeight: 600, fontSize: '40px', color: 'var(--fg)' }}>{progressPct}%</span>
            </div>
          </div>
          <div className="font-display mt-3.5" style={{ fontSize: '23px', color: 'var(--fg)' }}>Planejamento</div>
          <div style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '2px' }}>
            {checklistDone} concluída{checklistDone === 1 ? '' : 's'} · {Math.max(checklistTotal - checklistDone, 0)} pendente{checklistTotal - checklistDone === 1 ? '' : 's'}
          </div>
        </div>

        {/* Convidados */}
        <div className="flex flex-col items-center justify-center rounded-3xl bg-[var(--surface)] p-7 text-center" style={{ boxShadow: '0 12px 30px rgba(60,40,24,0.07)' }}>
          <span style={{ color: 'var(--wedding-color)' }}><UsersIcon size={26} /></span>
          <div className="font-display mt-2" style={{ fontSize: '23px', color: 'var(--fg)' }}>Convidados</div>
          <div style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '6px' }}>
            <span style={{ fontWeight: 700, color: '#5E8B6A' }}>{confirmedGuests} confirmado{confirmedGuests === 1 ? '' : 's'}</span>
            {' · '}
            <span style={{ fontWeight: 700, color: 'var(--wedding-color-dark)' }}>{pendingGuests} pendente{pendingGuests === 1 ? '' : 's'}</span>
          </div>
        </div>

        {/* Wedding Score — recurso pago (grátis vê só o teaser) */}
        {weddingScore !== null ? (
          (() => {
            const meta = weddingScoreMeta(weddingScore)
            return (
              <div className="flex flex-col items-center justify-center rounded-3xl bg-[var(--surface)] p-7 text-center" style={{ boxShadow: '0 12px 30px rgba(60,40,24,0.07)' }}>
                <div style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted-fg)' }}>
                  Wedding Score
                </div>
                <span className="font-display" style={{ fontWeight: 600, fontSize: '52px', color: meta.color, marginTop: '4px', lineHeight: 1 }}>
                  {weddingScore}
                </span>
                <div
                  style={{
                    display: 'inline-flex', alignItems: 'center', marginTop: '10px',
                    padding: '4px 12px', borderRadius: '99px',
                    background: meta.bg, color: meta.color,
                    fontSize: '12px', fontWeight: 700,
                  }}
                >
                  {meta.label}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '8px' }}>
                  {meta.description}
                </div>
              </div>
            )
          })()
        ) : (
          <Link
            href="/perfil/planos"
            className="flex flex-col items-center justify-center gap-2 rounded-3xl p-7 text-center transition-colors"
            style={{ background: 'var(--wedding-color-subtle)', border: '1.5px dashed #D8C6A6', textDecoration: 'none' }}
          >
            <span style={{ color: 'var(--wedding-color)' }}><LockIcon size={24} /></span>
            <div className="font-display" style={{ fontWeight: 500, fontSize: '20px', color: 'var(--fg)' }}>
              Wedding Score
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: 0, maxWidth: '220px' }}>
              Descubra o quanto o planejamento do casamento já está avançado.
            </p>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--wedding-color)', textDecoration: 'underline' }}>
              Disponível no Premium
            </span>
          </Link>
        )}
      </div>

      {/* Próximas tarefas */}
      {upcomingTasks.length > 0 && (
        <div className="mb-4 rounded-[22px] bg-[var(--surface)] p-6" style={{ boxShadow: '0 10px 26px rgba(60,40,24,0.06)' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display" style={{ fontWeight: 500, fontSize: '24px', color: 'var(--fg)' }}>
              Próximas tarefas
            </h3>
            <Link href="/checklist" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wedding-color)', textDecoration: 'underline' }}>
              Ver todas
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {upcomingTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-3" style={{ fontSize: '14px' }}>
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex-shrink-0 rounded-md"
                    style={{ width: '18px', height: '18px', border: '1.5px solid #D8C6A6' }}
                  />
                  <span style={{ color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.label}
                  </span>
                </div>
                {task.due_date && (
                  <span style={{ color: 'var(--muted-fg)', fontSize: '13px', flexShrink: 0 }}>
                    {new Date(`${task.due_date}T00:00:00`).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
