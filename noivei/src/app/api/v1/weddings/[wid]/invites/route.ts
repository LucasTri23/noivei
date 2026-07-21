import { requireWeddingOwner, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkMemberLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { WeddingInvite } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

// Guard permite qualquer membro (é informação do casamento, não sensível), mas a RLS
// de wedding_invites ("wedding owner can read own invites") só libera linhas pro dono
// — um membro convidado recebe lista vazia aqui, não erro, mesmo padrão de RLS
// silenciosa usado no resto do projeto.
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    const { data, error } = await supabase
      .from('wedding_invites')
      .select('*')
      .eq('wedding_id', wid)
      .order('created_at', { ascending: false })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar convites.')

    return ok((data ?? []) as WeddingInvite[])
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwner(supabase, wid, user.id)

    const limitCheck = await checkMemberLimit(supabase, wid)
    if (!limitCheck.allowed) {
      return err(
        403,
        'MEMBER_LIMIT_REACHED',
        `Seu plano permite até ${limitCheck.limit} usuário(s) neste casamento. Faça upgrade para convidar mais pessoas.`,
        { current: limitCheck.current, limit: limitCheck.limit },
      )
    }

    const { data, error } = await supabase
      .from('wedding_invites')
      .insert({ wedding_id: wid, created_by: user.id })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao criar convite.')

    return ok(data as WeddingInvite, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
