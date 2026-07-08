import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateGuestSchema, ListGuestsQuerySchema } from '@/lib/api/validation/guest.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkGuestLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { Guest } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    const url = new URL(req.url)
    const parsed = ListGuestsQuerySchema.safeParse({
      status:     url.searchParams.get('status') ?? undefined,
      group_name: url.searchParams.get('group_name') ?? undefined,
    })
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Filtros inválidos.', parsed.error.flatten())
    }

    let query = supabase
      .from('guests')
      .select('*')
      .eq('wedding_id', wid)
      .order('name', { ascending: true })

    if (parsed.data.status) query = query.eq('status', parsed.data.status)
    if (parsed.data.group_name) query = query.eq('group_name', parsed.data.group_name)

    const { data, error } = await query

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar convidados.')

    return ok((data ?? []) as Guest[])
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    const body = await parseJsonBody(req)
    const parsed = CreateGuestSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const limitCheck = await checkGuestLimit(supabase, wid)
    if (!limitCheck.allowed) {
      return err(403, 'GUEST_LIMIT_REACHED', 'Limite de convidados do seu plano atingido.', {
        current: limitCheck.current,
        limit:   limitCheck.limit,
      })
    }

    const { data, error } = await supabase
      .from('guests')
      .insert({ ...parsed.data, wedding_id: wid })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao criar convidado.')

    return ok(data as Guest, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
