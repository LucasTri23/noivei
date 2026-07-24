import Link from 'next/link'

import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

export const metadata = { title: 'Admin · Usuários' }

const PAGE_SIZE = 30

interface ProfileRow {
  id: string
  full_name: string | null
  created_at: string
}

interface UsuariosPageProps {
  searchParams: Promise<{ plan?: string; search?: string; from?: string; to?: string; page?: string }>
}

async function resolveEmails(ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map()

  const serviceSupabase = createSupabaseService()
  const entries = await Promise.all(
    ids.map(async (id): Promise<[string, string | null]> => {
      const { data } = await serviceSupabase.auth.admin.getUserById(id)
      return [id, data.user?.email ?? null]
    }),
  )
  return new Map(entries)
}

async function resolveCurrentPlans(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()

  const { data } = await supabase
    .from('subscriptions')
    .select('user_id, plan_id')
    .in('user_id', ids)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const result = new Map<string, string>()
  for (const row of (data ?? []) as { user_id: string; plan_id: string }[]) {
    if (!result.has(row.user_id)) result.set(row.user_id, row.plan_id)
  }
  return result
}

async function resolveWeddings(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()

  const { data } = await supabase
    .from('weddings')
    .select('user_id, couple_names')
    .in('user_id', ids)
    .is('deleted_at', null)

  const result = new Map<string, string>()
  for (const row of (data ?? []) as { user_id: string; couple_names: string }[]) {
    if (!result.has(row.user_id)) result.set(row.user_id, row.couple_names)
  }
  return result
}

function buildHref(params: { plan?: string; search?: string; from?: string; to?: string }, page: number) {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.plan) qs.set('plan', params.plan)
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  qs.set('page', String(page))
  return `/admin/usuarios?${qs.toString()}`
}

export default async function AdminUsuariosPage({ searchParams }: UsuariosPageProps) {
  const params = await searchParams
  const supabase = await createSupabaseServer()

  const page = Math.max(1, Number(params.page) || 1)
  const rangeFrom = (page - 1) * PAGE_SIZE
  const rangeTo = rangeFrom + PAGE_SIZE - 1

  // Todos os planos (não só ativos) — um usuário pode estar num plano já desativado
  // pelo admin, e o filtro/rótulo ainda precisam funcionar pra ele.
  const { data: plansData } = await supabase.from('plans').select('id, name').order('sort_order')
  const planOptions = (plansData ?? []) as { id: string; name: string }[]
  const planNameById = new Map(planOptions.map((p) => [p.id, p.name]))

  let matchingUserIds: string[] | null = null
  if (params.plan) {
    const { data: subRows } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('plan_id', params.plan)
      .eq('status', 'active')

    matchingUserIds = Array.from(new Set(((subRows ?? []) as { user_id: string }[]).map((s) => s.user_id)))
  }

  let profiles: ProfileRow[] = []
  let totalCount = 0

  if (!matchingUserIds || matchingUserIds.length > 0) {
    let query = supabase.from('profiles').select('id, full_name, created_at', { count: 'exact' })

    if (matchingUserIds) query = query.in('id', matchingUserIds)
    // Só busca por nome — casar com e-mail exigiria puxar cada usuário candidato de
    // auth.users individualmente, o que não escala para uma busca textual sobre
    // TODOS os usuários. Fora de escopo aqui.
    if (params.search) query = query.ilike('full_name', `%${params.search}%`)
    if (params.from) query = query.gte('created_at', params.from)
    if (params.to) query = query.lte('created_at', `${params.to}T23:59:59.999Z`)

    const { data, count } = await query
      .order('created_at', { ascending: false })
      .range(rangeFrom, rangeTo)

    profiles = (data ?? []) as ProfileRow[]
    totalCount = count ?? 0
  }

  const ids = profiles.map((p) => p.id)

  const [emailByUserId, planByUserId, weddingByUserId] = await Promise.all([
    resolveEmails(ids),
    resolveCurrentPlans(supabase, ids),
    resolveWeddings(supabase, ids),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const hasFilters = Boolean(params.search || params.plan || params.from || params.to)

  return (
    <div>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: '#2A1E10', margin: '0 0 6px' }}
      >
        Usuários
      </h1>
      <p style={{ fontSize: '14.5px', color: '#8A7560', margin: '0 0 22px' }}>
        {totalCount} usuário{totalCount === 1 ? '' : 's'} encontrado{totalCount === 1 ? '' : 's'}.
      </p>

      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl p-4"
        style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(60,40,24,0.07)' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px', color: '#8A7560' }}>
          Nome
          <input
            type="text"
            name="search"
            defaultValue={params.search ?? ''}
            placeholder="Buscar por nome"
            style={{ border: '1px solid #EFE7DC', borderRadius: '10px', padding: '8px 10px', fontSize: '13.5px', color: '#2A1E10', minWidth: '180px' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px', color: '#8A7560' }}>
          Plano
          <select
            name="plan"
            defaultValue={params.plan ?? ''}
            style={{ border: '1px solid #EFE7DC', borderRadius: '10px', padding: '8px 10px', fontSize: '13.5px', color: '#2A1E10', minWidth: '190px' }}
          >
            <option value="">Todos os planos</option>
            {planOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px', color: '#8A7560' }}>
          De
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ''}
            style={{ border: '1px solid #EFE7DC', borderRadius: '10px', padding: '8px 10px', fontSize: '13.5px', color: '#2A1E10' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px', color: '#8A7560' }}>
          Até
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ''}
            style={{ border: '1px solid #EFE7DC', borderRadius: '10px', padding: '8px 10px', fontSize: '13.5px', color: '#2A1E10' }}
          />
        </label>

        <button
          type="submit"
          style={{
            background: '#2A1E10', color: '#FAF0E6', border: 'none', borderRadius: '10px',
            padding: '9px 18px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Filtrar
        </button>

        {hasFilters && (
          <Link href="/admin/usuarios" style={{ fontSize: '13px', color: '#8A7560', textDecoration: 'underline' }}>
            Limpar filtros
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl" style={{ background: '#FFFFFF', boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #EFE7DC', textAlign: 'left' }}>
              {['Nome', 'E-mail', 'Plano', 'Casamento', 'Cadastrado em'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#8A7560', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', color: '#8A7560' }}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {profiles.map((p, idx) => {
              const planId = planByUserId.get(p.id) ?? 'free'
              const planLabel = planNameById.get(planId) ?? planId
              const coupleNames = weddingByUserId.get(p.id)

              return (
                <tr key={p.id} style={{ borderBottom: idx < profiles.length - 1 ? '1px solid #F8F3EE' : 'none' }}>
                  <td style={{ padding: '12px 16px', color: '#2A1E10', fontWeight: 500 }}>
                    {p.full_name || 'Sem nome'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#2A1E10' }}>
                    {emailByUserId.get(p.id) ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#2A1E10' }}>
                    {planLabel}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#2A1E10' }}>
                    {coupleNames ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#2A1E10' }}>
                    {new Date(p.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between" style={{ fontSize: '13px', color: '#8A7560' }}>
        <span>Página {page} de {totalPages}</span>
        <div className="flex gap-3">
          {page > 1 && (
            <Link href={buildHref(params, page - 1)} style={{ color: '#2A1E10', textDecoration: 'underline' }}>
              ← Anterior
            </Link>
          )}
          {page < totalPages && (
            <Link href={buildHref(params, page + 1)} style={{ color: '#2A1E10', textDecoration: 'underline' }}>
              Próxima →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
