import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'
import type { WeddingMember } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

export interface WeddingMemberWithProfile extends WeddingMember {
  full_name: string | null
  email:     string | null
}

interface ProfileRow {
  id:        string
  full_name: string | null
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    const { data: memberRows, error: membersError } = await supabase
      .from('wedding_members')
      .select('id, wedding_id, user_id, role, permissions, created_at')
      .eq('wedding_id', wid)
      .order('created_at', { ascending: true })

    if (membersError) return err(500, 'DB_ERROR', 'Erro ao listar membros.')

    const members = (memberRows ?? []) as WeddingMember[]
    const userIds = members.map((m) => m.user_id)

    // Sem FK direta entre wedding_members e profiles (ambas referenciam auth.users) —
    // PostgREST não embeda automaticamente, então busca em duas queries. A policy de
    // profiles adicionada em 20260703000012 é o que permite enxergar nomes além do
    // próprio, restrita a quem já é membro do mesmo casamento.
    const { data: profileRows } = userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] as ProfileRow[] }

    const namesByUserId = new Map(
      ((profileRows ?? []) as ProfileRow[]).map((p) => [p.id, p.full_name || null]),
    )

    // full_name pode não existir (conta criada antes do trigger, ou nunca preenchido —
    // fn_on_user_created grava '' por padrão, não NULL). E-mail é o identificador que
    // sempre existe, então é o fallback — sem isso a lista mostrava "Sem nome" pra
    // todo mundo sem jeito nenhum de saber quem é quem. profiles não guarda e-mail
    // (fica só em auth.users), e o client autenticado comum não pode ler auth.users
    // de outro usuário — por isso o lookup usa o client service role aqui, só depois
    // de já ter confirmado (requireWeddingOwnership) que quem pediu pode ver a lista.
    const serviceSupabase = createSupabaseService()
    const emailsByUserId = new Map<string, string | null>(
      await Promise.all(
        userIds.map(async (id): Promise<[string, string | null]> => {
          const { data } = await serviceSupabase.auth.admin.getUserById(id)
          return [id, data.user?.email ?? null]
        }),
      ),
    )

    const result: WeddingMemberWithProfile[] = members.map((m) => ({
      ...m,
      full_name: namesByUserId.get(m.user_id) ?? null,
      email:     emailsByUserId.get(m.user_id) ?? null,
    }))

    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}
