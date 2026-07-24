import { createSupabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'Admin · Dashboard' }

interface ActiveSubscriptionRow {
  user_id: string
  plan_id: string
}

function statCard(label: string, value: number | string, color = '#2A1E10', reactKey = label) {
  return (
    <div
      key={reactKey}
      className="rounded-2xl p-5"
      style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(60,40,24,0.07)', textAlign: 'center' }}
    >
      <div className="font-display" style={{ fontSize: '38px', fontWeight: 600, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '12.5px', color: '#8A7560', marginTop: '4px', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  )
}

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServer()

  // Server Component: renderiza por request, então ler o relógio aqui é intencional
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalUsers },
    { count: totalWeddings },
    { count: newLast7 },
    { count: newLast30 },
    { data: activeSubsRaw },
    { data: plansData },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('weddings').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    supabase
      .from('subscriptions')
      .select('user_id, plan_id')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    // Todos os planos (não só ativos) — histórico de assinatura pode apontar pra um
    // plano já desativado, e a distribuição ainda precisa mostrar o nome certo.
    supabase.from('plans').select('id, name').order('sort_order'),
  ])

  const activeSubs = (activeSubsRaw ?? []) as ActiveSubscriptionRow[]
  const planOrder = (plansData ?? []) as { id: string; name: string }[]

  // subscriptions guarda histórico (troca de plano gera nova linha) — a linha "atual"
  // de cada usuário é a mais recente com status='active', por isso a lista já vem
  // ordenada por created_at desc e só a primeira ocorrência de cada user_id é mantida.
  const latestPlanByUser = new Map<string, string>()
  for (const sub of activeSubs) {
    if (!latestPlanByUser.has(sub.user_id)) latestPlanByUser.set(sub.user_id, sub.plan_id)
  }

  const planCounts: Record<string, number> = Object.fromEntries(planOrder.map((p) => [p.id, 0]))

  for (const planId of latestPlanByUser.values()) {
    if (planId in planCounts) planCounts[planId] = (planCounts[planId] ?? 0) + 1
    else planCounts.free = (planCounts.free ?? 0) + 1
  }

  // Usuário sem nenhuma linha de assinatura ativa é, por definição, Gratuito —
  // sem isso a distribuição só contaria quem já passou pelo seletor de planos.
  const usersWithoutActiveSub = Math.max(0, (totalUsers ?? 0) - latestPlanByUser.size)
  planCounts.free = (planCounts.free ?? 0) + usersWithoutActiveSub

  return (
    <div>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: '#2A1E10', margin: '0 0 6px' }}
      >
        Dashboard
      </h1>
      <p style={{ fontSize: '14.5px', color: '#8A7560', margin: '0 0 28px' }}>
        Visão geral de usuários e casamentos cadastrados na plataforma.
      </p>

      <div className="mb-8 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))' }}>
        {statCard('Usuários', totalUsers ?? 0)}
        {statCard('Casamentos', totalWeddings ?? 0)}
        {statCard('Novos (7 dias)', newLast7 ?? 0)}
        {statCard('Novos (30 dias)', newLast30 ?? 0)}
      </div>

      <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#2A1E10', margin: '0 0 12px' }}>
        Distribuição por plano
      </h2>
      <div className="mb-6 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))' }}>
        {planOrder.map((plan) => statCard(plan.name, planCounts[plan.id] ?? 0, undefined, plan.id))}
      </div>

      <p style={{ fontSize: '12.5px', color: '#8A7560', lineHeight: 1.6, maxWidth: '640px' }}>
        Não há gateway de pagamento integrado ainda: os números acima refletem o que está
        gravado em <code>subscriptions.plan_id</code>, hoje definido manualmente pelo próprio
        usuário no seletor de planos, não uma cobrança real. Não há faturamento (MRR) a
        exibir enquanto nenhum dinheiro de fato circula pela plataforma.
      </p>
    </div>
  )
}
